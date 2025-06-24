import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('company_info')
@Index(['ticker'], { unique: false })
export class CompanyInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ticker: string;

  @Column({ type: 'varchar', length: 255 })
  company_name: string;

  @Column({ type: 'varchar', length: 100 })
  sector: string;

  @Column({ type: 'varchar', length: 100 })
  industry: string;

  @Column({ type: 'varchar', length: 100 })
  headquarters: string;

  @Column({ type: 'date', nullable: true })
  founded_date: Date;

  @Column({ type: 'datetime2', default: () => 'GETDATE()' })
  created_at: Date;
}