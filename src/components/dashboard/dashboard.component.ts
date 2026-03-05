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
  template: `
<div class="h-screen w-full flex flex-col bg-gray-900 text-gray-200">
  <!-- Header -->
  <header class="flex-shrink-0 bg-gray-800 border-b border-gray-700">
    <div class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center space-x-4">
        <svg class="h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75a.75.75 0 0 0 .75-.75V5.25m0 13.5V18a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 0-.75.75v.75m0 0h.01M12 12h.01M12 15h.01M12 18h.01" />
        </svg>
        <span class="text-xl font-bold">Crypto Dashboard</span>
      </div>
      <div class="flex items-center space-x-6">
        <div class="text-right">
            <span class="text-xs text-gray-400 block">Total Portfolio Value</span>
            <span class="text-lg font-semibold font-mono">{{ formatCurrency(totalPortfolioValueUSD()) }}</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-sm font-medium">Trading</span>
          <button (click)="toggleTrading()"
            [class]="isTradingActive() ? 'bg-green-500' : 'bg-gray-600'"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            <span [class]="isTradingActive() ? 'translate-x-5' : 'translate-x-0'"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
          </button>
        </div>
        <button (click)="logout.emit()" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">
          Logout
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex-grow flex flex-col md:flex-row overflow-hidden">
    <!-- Left Panel: Chart and Orders -->
    <div class="flex-grow flex flex-col p-4 md:p-6 space-y-6 overflow-y-auto">
      <!-- Coin Info Header -->
      <div class="flex items-center space-x-4">
        <img [src]="selectedCoin().image" alt="coin logo" class="h-10 w-10"/>
        <div>
          <h1 class="text-2xl font-bold">{{ selectedCoin().name }} ({{ selectedCoin().symbol.toUpperCase() }})</h1>
          <div class="flex items-baseline space-x-2">
            <p class="text-3xl font-light">{{ formatCurrency(selectedCoin().current_price) }}</p>
            <p [class]="selectedCoin().price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'">
              {{ selectedCoin().price_change_percentage_24h.toFixed(2) }}%
            </p>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div class="flex-grow h-64 md:h-96 bg-gray-800 rounded-lg p-4">
        <app-chart [data]="selectedCoin().price_history" [isPositiveChange]="selectedCoin().price_change_percentage_24h >= 0"></app-chart>
      </div>

      <!-- Order History -->
      <div class="bg-gray-800 rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3">Order History</h2>
        <div class="overflow-x-auto">
          @if (orders().length > 0) {
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-gray-400 uppercase bg-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-2">Coin</th>
                  <th scope="col" class="px-4 py-2">Type</th>
                  <th scope="col" class="px-4 py-2">Amount</th>
                  <th scope="col" class="px-4 py-2">Price</th>
                  <th scope="col" class="px-4 py-2">Status</th>
                  <th scope="col" class="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (order of orders(); track order.id) {
                  <tr class="border-b border-gray-700">
                    <td class="px-4 py-2 font-medium">{{ order.coin.symbol.toUpperCase() }}</td>
                    <td class="px-4 py-2">
                      <span [class]="order.type === 'BUY' ? 'text-green-400' : 'text-red-400'">{{ order.type }}</span>
                      <span class="text-gray-400 text-xs"> ({{ order.orderType }})</span>
                    </td>
                    <td class="px-4 py-2">{{ formatNumber(order.amount) }}</td>
                    <td class="px-4 py-2">{{ formatCurrency(order.price) }}</td>
                    <td class="px-4 py-2"
                      [class.text-green-400]="order.status === 'FILLED'"
                      [class.text-yellow-400]="order.status === 'OPEN'"
                      [class.text-gray-500]="order.status === 'CANCELLED'">
                      <span [class.line-through]="order.status === 'CANCELLED'">{{ order.status }}</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                        @if (order.status === 'OPEN') {
                            <button (click)="cancelOrder(order)" class="text-red-400 hover:text-red-300 text-xs font-semibold">CANCEL</button>
                        }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-center text-gray-500 py-4">No order history.</p>
          }
        </div>
      </div>
    </div>

    <!-- Right Panel: Trade Form and Market List -->
    <aside class="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col">
      <div class="p-6 space-y-6 overflow-y-auto">
        <!-- Trade Form -->
        <div>
          <h2 class="text-xl font-bold mb-4">Trade</h2>
          <div class="grid grid-cols-3 gap-2 mb-4 text-sm font-semibold">
            <button (click)="setOrderType('MARKET')" [class]="orderType() === 'MARKET' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'" class="py-2 rounded-md transition-colors">Market</button>
            <button (click)="setOrderType('LIMIT')" [class]="orderType() === 'LIMIT' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'" class="py-2 rounded-md transition-colors">Limit</button>
            <button (click)="setOrderType('STOP')" [class]="orderType() === 'STOP' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'" class="py-2 rounded-md transition-colors">Stop</button>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-4">
            <button (click)="setTradeType('BUY')" [class]="tradeType() === 'BUY' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'" class="py-2 rounded-md font-semibold transition-colors">Buy</button>
            <button (click)="setTradeType('SELL')" [class]="tradeType() === 'SELL' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'" class="py-2 rounded-md font-semibold transition-colors">Sell</button>
          </div>
          <div class="space-y-4">
            <div>
              <label for="amount" class="text-sm font-medium text-gray-400 flex justify-between">
                  <span>Amount ({{ selectedCoin().symbol.toUpperCase() }})</span>
                  <span>Bal: {{ formatNumber(assetBalance()) }}</span>
              </label>
              <input [(ngModel)]="tradeAmount" type="number" name="amount" id="amount" class="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 mt-1" placeholder="0.0000" step="0.0001">
            </div>
            @if (orderType() === 'LIMIT') {
              <div>
                <label for="limitPrice" class="text-sm font-medium text-gray-400">Limit Price (USD)</label>
                <input [(ngModel)]="limitPrice" type="number" name="limitPrice" id="limitPrice" class="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 mt-1" placeholder="0.00">
              </div>
            }
            @if (orderType() === 'STOP') {
              <div>
                <label for="stopPrice" class="text-sm font-medium text-gray-400">Stop Price (USD)</label>
                <input [(ngModel)]="stopPrice" type="number" name="stopPrice" id="stopPrice" class="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 mt-1" placeholder="0.00">
              </div>
            }
            <div class="text-sm text-gray-400 space-y-2">
               <div class="flex justify-between"><span>Available USD:</span><span class="font-mono">{{ formatCurrency(usdBalance()) }}</span></div>
               <div class="flex justify-between"><span>Est. Total:</span><span class="font-mono">{{ formatCurrency(totalCost()) }}</span></div>
            </div>
            <button (click)="placeOrder()" [disabled]="!isTradingActive() || !tradeAmount()"
              class="w-full font-semibold py-3 rounded-lg transition-colors"
              [class]="(isTradingActive() && tradeAmount() > 0 ? (tradeType() === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700') : 'bg-gray-600 cursor-not-allowed')">
              {{ tradeType() === 'BUY' ? 'Buy' : 'Sell' }} {{ selectedCoin().symbol.toUpperCase() }}
            </button>
            @if (!isTradingActive()) { <p class="text-center text-xs text-yellow-400 mt-2">Trading is currently disabled.</p> }
          </div>
        </div>

        <!-- Market List -->
        <div class="flex-grow p-4 border-t border-gray-700">
          <h2 class="text-xl font-bold mb-4">Markets</h2>
          <div class="space-y-3">
            @for (coin of allCoins(); track coin.id) {
              <div (click)="selectCoin(coin)" 
                class="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                [class]="selectedCoin().id === coin.id ? 'bg-indigo-600/30' : 'hover:bg-gray-700/50'">
                <div class="flex items-center space-x-3">
                  <img [src]="coin.image" alt="coin logo" class="h-8 w-8"/>
                  <div>
                    <p class="font-semibold">{{ coin.symbol.toUpperCase() }}</p>
                    <p class="text-xs text-gray-400">{{ coin.name }}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-medium font-mono">{{ formatCurrency(coin.current_price) }}</p>
                  <p class="text-sm" [class]="coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'">
                    {{ coin.price_change_percentage_24h.toFixed(2) }}%
                  </p>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </aside>
  </div>
  <footer class="flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 border-t border-gray-700">
    Made with ❤️ by David Castillo PhiConsulting
  </footer>
</div>
  `,
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