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
  template: `
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
  <div class="w-full max-w-4xl h-[90vh] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
      <div class="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-indigo-400">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.472-2.472a3.375 3.375 0 0 0-4.773-4.773L6.75 11.42m5.877 5.877L5.88 15.172a3.375 3.375 0 0 1-4.773-4.773L5.12 6.75M6.75 11.42l4.773-4.773" />
        </svg>
        <h2 class="text-xl font-bold">Trading Simulator</h2>
      </div>
      <button (click)="close.emit()" class="text-gray-400 hover:text-white transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- Content -->
    <div class="flex-grow flex flex-col md:flex-row overflow-hidden">
        <!-- Left Panel: Controls & Portfolio -->
        <div class="w-full md:w-1/3 p-4 border-r border-gray-700 flex flex-col gap-6">
            <!-- Controls -->
            <div class="bg-gray-900/50 p-4 rounded-lg">
                <h3 class="font-semibold mb-4">Controls</h3>
                <div class="flex gap-2">
                    <button (click)="start()" [disabled]="isActive()"
                        class="w-full font-semibold py-2 rounded-md bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        Start
                    </button>
                    <button (click)="stop()" [disabled]="!isActive()"
                        class="w-full font-semibold py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        Stop
                    </button>
                </div>
                <div class="mt-4 space-y-3">
                    <div>
                        <label for="speed" class="text-sm font-medium text-gray-400">Speed (ms/trade)</label>
                        <input [(ngModel)]="simulationSpeed" (ngModelChange)="onSpeedChange()" type="range" id="speed" min="500" max="3000" step="100" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                        <span class="text-xs text-center block font-mono">{{ simulationSpeed() }}ms</span>
                    </div>
                     <div>
                        <label for="maxTrade" class="text-sm font-medium text-gray-400">Max Trade Size (USD)</label>
                        <input [(ngModel)]="maxTradeUsd" type="range" id="maxTrade" min="50" max="2000" step="50" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                        <span class="text-xs text-center block font-mono">{{ formatCurrency(maxTradeUsd()) }}</span>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700">
                    <button (click)="getAiSuggestedSettings()" [disabled]="isSuggesting() || isActive()"
                        class="w-full flex justify-center items-center gap-2 font-semibold py-2 rounded-md transition-colors bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/50 disabled:cursor-not-allowed">
                        @if (isSuggesting()) {
                            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Suggesting...</span>
                        } @else {
                            <span>Get AI-Suggested Settings</span>
                        }
                    </button>
                    @if (isActive()) {
                        <p class="text-xs text-yellow-500 text-center mt-2">Stop the simulation to get suggestions.</p>
                    }
                </div>
            </div>

            <!-- AI Suggestion Card -->
            @if (suggestedSettings(); as settings) {
                <div class="bg-indigo-900/50 p-4 rounded-lg border border-indigo-700 space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-xs text-indigo-300">Suggested Strategy</p>
                            <h4 class="font-semibold">{{ settings.strategyName }}</h4>
                        </div>
                        <button (click)="suggestedSettings.set(null)" class="text-indigo-300 hover:text-white">&times;</button>
                    </div>
                    <p class="text-xs text-gray-400">{{ settings.rationale }}</p>
                    <div class="text-sm space-y-1 font-mono">
                        <p>Speed: <span class="font-semibold text-white">{{ settings.simulationSpeed }}ms</span></p>
                        <p>Max Trade: <span class="font-semibold text-white">{{ formatCurrency(settings.maxTradeUsd) }}</span></p>
                    </div>
                    <button (click)="applySuggestedSettings()" class="w-full text-sm font-semibold py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        Apply Settings
                    </button>
                </div>
            }

            <!-- Portfolio -->
            <div class="bg-gray-900/50 p-4 rounded-lg flex-grow">
                <h3 class="font-semibold mb-2">Simulator Portfolio</h3>
                <div class="text-3xl font-mono mb-4">{{ formatCurrency(totalPortfolioValueUSD()) }}</div>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400">USD Balance:</span>
                        <span class="font-mono">{{ formatCurrency(portfolio()['usd'] || 0) }}</span>
                    </div>
                    @for (coin of allCoins(); track coin.id) {
                        @if (portfolio()[coin.symbol.toLowerCase()]) {
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400">{{ coin.symbol.toUpperCase() }} Balance:</span>
                                <span class="font-mono">{{ formatNumber(portfolio()[coin.symbol.toLowerCase()]) }}</span>
                            </div>
                        }
                    }
                </div>
            </div>
        </div>

        <!-- Right Panel: Trade Log -->
        <div class="flex-grow p-4 flex flex-col">
            <h3 class="font-semibold mb-2 flex-shrink-0">Trade Log</h3>
            <div class="flex-grow overflow-y-auto">
                @if (tradeLog().length > 0) {
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                        <tr>
                            <th scope="col" class="px-3 py-2">Time</th>
                            <th scope="col" class="px-3 py-2">Coin</th>
                            <th scope="col" class="px-3 py-2">Type</th>
                            <th scope="col" class="px-3 py-2">Amount</th>
                            <th scope="col" class="px-3 py-2">Price</th>
                            <th scope="col" class="px-3 py-2">Value</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        @for (order of tradeLog(); track order.id) {
                        <tr class="hover:bg-gray-700/30">
                            <td class="px-3 py-2 font-mono text-xs">{{ (new Date(order.id)).toLocaleTimeString() }}</td>
                            <td class="px-3 py-2 font-medium">{{ order.coin.symbol.toUpperCase() }}</td>
                            <td class="px-3 py-2">
                                <span [class]="order.type === 'BUY' ? 'text-green-400' : 'text-red-400'">{{ order.type }}</span>
                            </td>
                            <td class="px-3 py-2 font-mono">{{ formatNumber(order.amount) }}</td>
                            <td class="px-3 py-2 font-mono">{{ formatCurrency(order.price) }}</td>
                            <td class="px-3 py-2 font-mono">{{ formatCurrency(order.cost) }}</td>
                        </tr>
                        }
                    </tbody>
                </table>
                 } @else {
                    <p class="text-center text-gray-500 pt-10">Simulation not started. Press Start to begin.</p>
                 }
            </div>
        </div>
    </div>
  </div>
</div>
  `,
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