import { Injectable, signal } from '@angular/core';
import { Cryptocurrency } from '../models/crypto.model';

const INITIAL_CRYPTO_DATA: Cryptocurrency[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    current_price: 68000,
    price_change_percentage_24h: 2.5,
    price_history: [66500, 67000, 66800, 67200, 67100, 67500, 67800, 68200, 68100, 68000],
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    current_price: 3500,
    price_change_percentage_24h: -1.2,
    price_history: [3550, 3540, 3560, 3530, 3520, 3510, 3540, 3530, 3510, 3500],
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    current_price: 150,
    price_change_percentage_24h: 5.8,
    price_history: [140, 142, 141, 145, 148, 147, 149, 151, 150, 150],
  },
    {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
    current_price: 0.15,
    price_change_percentage_24h: 0.5,
    price_history: [0.14, 0.142, 0.141, 0.145, 0.148, 0.147, 0.149, 0.151, 0.152, 0.15],
  }
];

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  cryptoData = signal<Cryptocurrency[]>(INITIAL_CRYPTO_DATA);

  // Parameters for a more realistic random walk price model
  private volatilities: { [key: string]: number } = {
    bitcoin: 0.005,  // Low volatility
    ethereum: 0.007,
    solana: 0.012,
    dogecoin: 0.02, // High volatility
  };

  private drifts: { [key: string]: number } = {
    bitcoin: 0.0001,
    ethereum: 0.00015,
    solana: 0.00025, // Higher positive drift
    dogecoin: 0.00005,
  };

  constructor() {
    setInterval(() => this.updatePrices(), 2000);
  }

  private updatePrices() {
    // Add a small probability of a market-wide "shock" event
    const marketEventChance = 0.04; // 4% chance every 2 seconds
    let marketShock = 0;
    if (Math.random() < marketEventChance) {
      // A shock between -8% and +8%
      marketShock = (Math.random() - 0.5) * 0.16;
    }

    this.cryptoData.update(coins =>
      coins.map(coin => {
        const volatility = this.volatilities[coin.id] || 0.01;
        const drift = this.drifts[coin.id] || 0;

        // Simulate a more normal-like random variable by averaging
        const randomFactor = (Math.random() + Math.random() + Math.random() - 1.5) / 2;

        // Calculate the base percentage change
        let changePercentage = drift + randomFactor * volatility;

        // Apply market shock if it occurs
        if (marketShock !== 0) {
          // The shock affects each coin slightly differently but in the same direction
          changePercentage += marketShock * (Math.random() * 0.5 + 0.75);
        }

        // Add a small probability of a coin-specific "news" event
        const coinEventChance = 0.02; // 2% chance
        if (Math.random() < coinEventChance) {
          const coinShock = (Math.random() - 0.5) * 0.2; // A shock of +/- 10%
          changePercentage += coinShock;
        }

        const newPrice = coin.current_price * (1 + changePercentage);
        
        // Ensure price never goes below a very small number
        const finalPrice = Math.max(newPrice, 0.000001);

        const newHistory = [...coin.price_history.slice(1), finalPrice];
        
        // The 24h change is a running total for simulation purposes
        const updated_24h_change = coin.price_change_percentage_24h + (changePercentage * 20);

        return {
          ...coin,
          current_price: finalPrice,
          price_change_percentage_24h: updated_24h_change,
          price_history: newHistory,
        };
      })
    );
  }
}
