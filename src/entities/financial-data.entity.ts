import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('financial_data')
@Index(['ticker'], { unique: false })
export class FinancialData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ticker: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  revenue: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  profit: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  assets: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  liabilities: number;

  @Column({ type: 'int', nullable: true })
  employees: number;

  @Column({ type: 'datetime2', default: () => 'GETDATE()' })
  created_at: Date;
}