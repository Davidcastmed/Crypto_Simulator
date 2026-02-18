import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency } from '../../models/crypto.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleGenAI, Type } from '@google/genai';

type TradeType = 'BUY' | 'SELL';

interface SimOrder {
  id: number;
  coin: Cryptocurrency;
  type: TradeType;
  amount: number;
  price: number;
  cost: number;
}

interface SuggestedSettings {
    strategyName: string;
    rationale: string;
    simulationSpeed: number;
    maxTradeUsd: number;
}


@Component({
  selector: 'app-simulator',
  templateUrl: './simulator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class SimulatorComponent implements OnDestroy {
  close = output<void>();
  cryptoService = inject(CryptoService);
  
  // --- State ---
  isActive = signal(false);
  portfolio = signal<{ [key: string]: number }>({ 'usd': 10000 });
  tradeLog = signal<SimOrder[]>([]);
  private intervalId: any;

  // --- Configuration ---
  simulationSpeed = signal(1000); // ms between trades
  maxTradeUsd = signal(500); // max USD value of a single trade

  // --- AI Suggestions ---
  isSuggesting = signal(false);
  suggestedSettings = signal<SuggestedSettings | null>(null);

  allCoins = this.cryptoService.cryptoData;

  constructor() {
  }

  ngOnDestroy(): void {
    this.stop();
  }

  start() {
    if (this.isActive()) return;
    this.isActive.set(true);
    this.intervalId = setInterval(() => this.runSimulationTick(), this.simulationSpeed());
  }

  stop() {
    this.isActive.set(false);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onSpeedChange() {
    if (this.isActive()) {
      this.stop();
      this.start();
    }
  }

  private runSimulationTick() {
    const coins = this.allCoins();
    if (coins.length === 0) return;

    // 1. Pick a random coin
    const coin = coins[Math.floor(Math.random() * coins.length)];
    const coinSymbol = coin.symbol.toLowerCase();

    // 2. Decide to buy or sell (simple 50/50 logic)
    const tradeType: TradeType = Math.random() > 0.5 ? 'BUY' : 'SELL';
    
    const usdBalance = this.portfolio()['usd'] || 0;
    const assetBalance = this.portfolio()[coinSymbol] || 0;

    if (tradeType === 'BUY') {
      if (usdBalance < 10) return; // Not enough money to make a meaningful trade
      const tradeValue = Math.random() * Math.min(this.maxTradeUsd(), usdBalance);
      if (tradeValue < 1) return; // Too small
      
      const amount = tradeValue / coin.current_price;
      this.executeTrade(coin, amount, 'BUY');

    } else { // SELL
      if (assetBalance <= 0) return; // Nothing to sell
      const amountToSell = Math.random() * assetBalance;
       if (amountToSell * coin.current_price < 1) return; // Too small
      
      this.executeTrade(coin, amountToSell, 'SELL');
    }
  }

  private executeTrade(coin: Cryptocurrency, amount: number, type: TradeType) {
      const coinSymbol = coin.symbol.toLowerCase();
      const price = coin.current_price;
      const cost = amount * price;

      this.portfolio.update(p => {
          const newPortfolio = {...p};
          if (type === 'BUY') {
              newPortfolio['usd'] -= cost;
              newPortfolio[coinSymbol] = (newPortfolio[coinSymbol] || 0) + amount;
          } else { // SELL
              newPortfolio['usd'] += cost;
              newPortfolio[coinSymbol] -= amount;
          }
          return newPortfolio;
      });

      const logEntry: SimOrder = { id: Date.now(), coin, type, amount, price, cost };
      this.tradeLog.update(log => [logEntry, ...log].slice(0, 100));
  }

  async getAiSuggestedSettings() {
    this.isSuggesting.set(true);
    this.suggestedSettings.set(null);
    try {
        const ai = new GoogleGenAI({ apiKey: (globalThis as any).process.env.API_KEY as string });
        const marketData = this.allCoins().map(c => 
            `- ${c.name}: Price=${this.formatCurrency(c.current_price)}, 24h Change=${c.price_change_percentage_24h.toFixed(2)}%`
        ).join('\n');

        const prompt = `
            You are a trading bot strategist. Based on the following crypto market data, suggest optimal settings for a trading simulator.
            The available settings are 'simulationSpeed' (time in ms between trades, 500-3000) and 'maxTradeUsd' (max USD value per trade, 50-2000).
            - A lower speed (e.g., 500ms) is aggressive. A higher speed (e.g., 2500ms) is conservative.
            - A higher max trade size is riskier.
            
            Current Market Data:
            ${marketData}

            Analyze the overall market sentiment (e.g., volatile, bullish, bearish, stable) from the data and provide settings that fit that sentiment.
            Return your response in the specified JSON format.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategyName: { type: Type.STRING, description: 'A creative name for the trading strategy.' },
                        rationale: { type: Type.STRING, description: 'A brief explanation for the chosen settings based on market data.' },
                        simulationSpeed: { type: Type.INTEGER, description: 'The suggested speed in milliseconds.' },
                        maxTradeUsd: { type: Type.INTEGER, description: 'The suggested max trade size in USD.' },
                    },
                    required: ["strategyName", "rationale", "simulationSpeed", "maxTradeUsd"]
                },
            },
        });

        const resultText = response.text.trim();
        this.suggestedSettings.set(JSON.parse(resultText));

    } catch (error) {
        console.error("AI Suggestion failed:", error);
        alert("Failed to get AI-suggested settings. Please check the console.");
    } finally {
        this.isSuggesting.set(false);
    }
  }

  applySuggestedSettings() {
    const settings = this.suggestedSettings();
    if (settings) {
      this.simulationSpeed.set(settings.simulationSpeed);
      this.maxTradeUsd.set(settings.maxTradeUsd);
      this.suggestedSettings.set(null); // Hide after applying
    }
  }
  
  totalPortfolioValueUSD = computed(() => {
    const currentPortfolio = this.portfolio();
    const currentPrices = new Map(this.allCoins().map(c => [c.symbol.toLowerCase(), c.current_price]));
    let totalValue = currentPortfolio['usd'] || 0;
    for (const symbol in currentPortfolio) {
      if (symbol !== 'usd') {
        const amount = currentPortfolio[symbol];
        const price = currentPrices.get(symbol);
        if (amount > 0 && typeof price === 'number') {
          totalValue += amount * price;
        }
      }
    }
    return totalValue;
  });

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatNumber(value: number | undefined): string {
      if (value === undefined) return '0.0000';
      return value.toFixed(4);
  }
}