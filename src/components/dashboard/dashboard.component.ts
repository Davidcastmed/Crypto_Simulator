import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency } from '../../models/crypto.model';
import { ChartComponent } from '../chart/chart.component';

type TradeType = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP';

interface Order {
  id: number;
  coin: Cryptocurrency;
  type: TradeType;
  orderType: OrderType;
  amount: number;
  price: number; // For LIMIT, this is the limit price. For STOP, this is the trigger price.
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChartComponent]
})
export class DashboardComponent {
  logout = output<void>();
  
  cryptoService = inject(CryptoService);
  platformId = inject(PLATFORM_ID);

  allCoins = this.cryptoService.cryptoData;
  isTradingActive = signal(true);
  
  selectedCoin = signal<Cryptocurrency>(this.allCoins()[0]);
  
  tradeType = signal<TradeType>('BUY');
  orderType = signal<OrderType>('MARKET');
  tradeAmount = signal(0);
  limitPrice = signal(0);
  stopPrice = signal(0);

  orders = signal<Order[]>([]);
  portfolio = signal<{ [key: string]: number }>({
    'usd': 10000, 'btc': 0, 'eth': 0, 'sol': 0, 'doge': 0
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedPortfolio = localStorage.getItem('crypto_portfolio');
      if (savedPortfolio) this.portfolio.set(JSON.parse(savedPortfolio));
      
      const savedOrders = localStorage.getItem('crypto_orders');
      if (savedOrders) this.orders.set(JSON.parse(savedOrders));
    }

    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('crypto_portfolio', JSON.stringify(this.portfolio()));
        localStorage.setItem('crypto_orders', JSON.stringify(this.orders()));
      }
    });
    
    effect(() => {
        const coins = this.allCoins();
        if (this.orders().some(o => o.status === 'OPEN')) {
            const currentPrices: Map<string, number> = new Map(coins.map(c => [c.id, c.current_price]));
            this.processOpenOrders(currentPrices);
        }
    });
  }

  usdBalance = computed(() => this.portfolio()['usd'] || 0);
  assetBalance = computed(() => {
    const coinSymbol = this.selectedCoin().symbol.toLowerCase();
    return this.portfolio()[coinSymbol] || 0;
  });

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

  totalCost = computed(() => {
    const amount = this.tradeAmount();
    if (this.orderType() === 'LIMIT') return amount * (this.limitPrice() || 0);
    return amount * this.selectedCoin().current_price;
  });

  selectCoin(coin: Cryptocurrency) {
    this.selectedCoin.set(coin);
  }
  toggleTrading() { this.isTradingActive.update(active => !active); }
  setTradeType(type: TradeType) { this.tradeType.set(type); }
  setOrderType(type: OrderType) { this.orderType.set(type); }

  placeOrder() {
    const amount = this.tradeAmount();
    if (!amount || amount <= 0) return alert('Please enter a valid amount.');
    const orderType = this.orderType();
    if (orderType === 'LIMIT' && (!this.limitPrice() || this.limitPrice() <= 0)) return alert('Please enter a valid limit price.');
    if (orderType === 'STOP' && (!this.stopPrice() || this.stopPrice() <= 0)) return alert('Please enter a valid stop price.');
    
    if (orderType === 'MARKET') {
      this.executeMarketOrder(this.selectedCoin(), amount, this.tradeType());
    } else {
      this.createOpenOrder(this.selectedCoin(), amount, this.tradeType(), orderType);
    }
    this.tradeAmount.set(0); this.limitPrice.set(0); this.stopPrice.set(0);
  }
  
  private createOpenOrder(coin: Cryptocurrency, amount: number, type: TradeType, orderType: 'LIMIT' | 'STOP') {
      const price = orderType === 'LIMIT' ? this.limitPrice() : this.stopPrice();
      const cost = amount * price;
      const coinSymbol = coin.symbol.toLowerCase();

      if (type === 'BUY' && this.portfolio()['usd'] < cost && orderType === 'LIMIT') return alert('Insufficient USD balance for limit buy.');
      if (type === 'SELL' && (this.portfolio()[coinSymbol] || 0) < amount) return alert(`Insufficient ${coin.symbol} balance.`);
      
      const newOrder: Order = { id: Date.now(), coin, type, amount, price, status: 'OPEN', orderType };
      this.orders.update(o => [newOrder, ...o].slice(0, 100));
  }
  
  private executeTrade(order: {coin: Cryptocurrency, amount: number, type: TradeType, price: number}): { success: boolean, message?: string } {
    const currentPortfolio = this.portfolio();
    const coinSymbol = order.coin.symbol.toLowerCase();
    const cost = order.amount * order.price;

    if (order.type === 'BUY') {
        const usdBalance = currentPortfolio['usd'];
        if (usdBalance < cost) return { success: false, message: `Insufficient USD. Required: ${this.formatCurrency(cost)}, Have: ${this.formatCurrency(usdBalance)}.` };
    } else {
        const assetBalance = currentPortfolio[coinSymbol] || 0;
        if (assetBalance < order.amount) return { success: false, message: `Insufficient ${order.coin.symbol.toUpperCase()}. Required: ${this.formatNumber(order.amount)}, Have: ${this.formatNumber(assetBalance)}.` };
    }

    let wasSuccessful = false;
    this.portfolio.update(p => {
        const newPortfolio = {...p};
        if (order.type === 'BUY' && p['usd'] >= cost) {
            newPortfolio['usd'] -= cost;
            newPortfolio[coinSymbol] = (newPortfolio[coinSymbol] || 0) + order.amount;
            wasSuccessful = true; return newPortfolio;
        }
        if (order.type === 'SELL' && (p[coinSymbol] || 0) >= order.amount) {
            newPortfolio['usd'] += cost;
            newPortfolio[coinSymbol] -= order.amount;
            wasSuccessful = true; return newPortfolio;
        }
        return p;
    });

    if (wasSuccessful) return { success: true };
    return { success: false, message: 'Trade failed. Balance may have changed.' };
  }

  private executeMarketOrder(coin: Cryptocurrency, amount: number, type: TradeType) {
    const order = { coin, amount, type, price: coin.current_price };

    const result = this.executeTrade(order);
    if (result.success) {
      const newOrder: Order = { id: Date.now(), ...order, status: 'FILLED', orderType: 'MARKET' };
      this.orders.update(o => [newOrder, ...o].slice(0, 100));
    } else {
      alert(result.message || 'Trade failed due to an unknown error.');
    }
  }

  cancelOrder(orderToCancel: Order) {
    this.orders.update(currentOrders => 
        currentOrders.map(o => o.id === orderToCancel.id && o.status === 'OPEN' ? { ...o, status: 'CANCELLED' } : o)
    );
  }

  private processOpenOrders(currentPrices: Map<string, number>) {
    const ordersToFill: Order[] = [];
    this.orders().forEach(order => {
        if (order.status !== 'OPEN') return;
        const currentPrice = currentPrices.get(order.coin.id);
        if (currentPrice === undefined) return;

        let shouldFill = false;
        if (order.orderType === 'LIMIT') shouldFill = (order.type === 'BUY' && currentPrice <= order.price) || (order.type === 'SELL' && currentPrice >= order.price);
        else if (order.orderType === 'STOP') shouldFill = (order.type === 'BUY' && currentPrice >= order.price) || (order.type === 'SELL' && currentPrice <= order.price);
        
        if (shouldFill) {
            ordersToFill.push(order);
        }
    });

    if (ordersToFill.length > 0) {
        const filledIds = new Set<number>();
        ordersToFill.forEach(order => {
            const executionPrice = order.orderType === 'STOP' ? currentPrices.get(order.coin.id)! : order.price;

            const result = this.executeTrade({ ...order, price: executionPrice });
            if (result.success) {
                filledIds.add(order.id);
            }
        });

        if (filledIds.size > 0) {
            this.orders.update(currentOrders => currentOrders.map(o => {
                if (filledIds.has(o.id)) return { ...o, status: 'FILLED' };
                return o;
            }));
        }
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 8 : 2 }).format(value);
  }

  formatNumber(value: number | undefined): string {
      if (value === undefined) return '0.0000';
      return value.toFixed(4);
  }
}