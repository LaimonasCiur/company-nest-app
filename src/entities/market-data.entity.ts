import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('market_data')
@Index(['ticker'], { unique: false })
export class MarketData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ticker: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stock_price: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  market_cap: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pe_ratio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  dividend_yield: number;

  @Column({ type: 'bigint', nullable: true })
  volume: number;

  @Column({ type: 'datetime2', default: () => 'GETDATE()' })
  created_at: Date;
}