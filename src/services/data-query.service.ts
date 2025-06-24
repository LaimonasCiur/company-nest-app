import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialData } from '../entities/financial-data.entity';
import { MarketData } from '../entities/market-data.entity';
import { CompanyInfo } from '../entities/company-info.entity';

@Injectable()
export class DataQueryService {
  constructor(
    @InjectRepository(FinancialData)
    private financialDataRepository: Repository<FinancialData>,
    @InjectRepository(MarketData)
    private marketDataRepository: Repository<MarketData>,
    @InjectRepository(CompanyInfo)
    private companyInfoRepository: Repository<CompanyInfo>,
  ) {}

  async queryDataPoint(ticker: string, dataPoint: string, tableName: string): Promise<any> {
    // Validate table name
    const validTables = ['financial_data', 'market_data', 'company_info'];
    if (!validTables.includes(tableName)) {
      throw new BadRequestException(`Invalid table name. Must be one of: ${validTables.join(', ')}`);
    }

    // Get the appropriate repository and valid columns
    const { repository, validColumns } = this.getRepositoryAndColumns(tableName);

    // Validate data point (column name)
    if (!validColumns.includes(dataPoint)) {
      throw new BadRequestException(
        `Invalid data point '${dataPoint}' for table '${tableName}'. Valid columns: ${validColumns.join(', ')}`
      );
    }

    // Query the data
    const queryBuilder = repository.createQueryBuilder('entity');
    queryBuilder
      .select([`entity.${dataPoint}`, 'entity.ticker'])
      .where('entity.ticker = :ticker', { ticker: ticker.toUpperCase() });

    const result = await queryBuilder.getOne();

    if (!result) {
      throw new NotFoundException(`No data found for ticker '${ticker}' in table '${tableName}'`);
    }

    return {
      ticker: result.ticker,
      dataPoint,
      tableName,
      value: result[dataPoint],
      timestamp: new Date().toISOString()
    };
  }

  private getRepositoryAndColumns(tableName: string): { repository: Repository<any>, validColumns: string[] } {
    switch (tableName) {
      case 'financial_data':
        return {
          repository: this.financialDataRepository,
          validColumns: ['revenue', 'profit', 'assets', 'liabilities', 'employees']
        };
      case 'market_data':
        return {
          repository: this.marketDataRepository,
          validColumns: ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume']
        };
      case 'company_info':
        return {
          repository: this.companyInfoRepository,
          validColumns: ['company_name', 'sector', 'industry', 'headquarters', 'founded_date']
        };
      default:
        throw new BadRequestException('Invalid table name');
    }
  }

  // Seed data method for testing
  async seedData(): Promise<void> {
    // Seed financial data
    const financialData = [
      { ticker: 'AAPL', revenue: 394328000000, profit: 99803000000, assets: 352755000000, liabilities: 302083000000, employees: 164000 },
      { ticker: 'GOOGL', revenue: 307394000000, profit: 73795000000, assets: 402392000000, liabilities: 120005000000, employees: 190234 },
      { ticker: 'MSFT', revenue: 211915000000, profit: 72361000000, assets: 411976000000, liabilities: 198298000000, employees: 221000 }
    ];

    for (const data of financialData) {
      const exists = await this.financialDataRepository.findOne({ where: { ticker: data.ticker } });
      if (!exists) {
        await this.financialDataRepository.save(data);
      }
    }

    // Seed market data
    const marketData = [
      { ticker: 'AAPL', stock_price: 189.87, market_cap: 2950000000000, pe_ratio: 29.55, dividend_yield: 0.44, volume: 45680000 },
      { ticker: 'GOOGL', stock_price: 138.21, market_cap: 1750000000000, pe_ratio: 23.71, dividend_yield: 0.00, volume: 28450000 },
      { ticker: 'MSFT', stock_price: 378.18, market_cap: 2810000000000, pe_ratio: 32.25, dividend_yield: 0.68, volume: 22340000 }
    ];

    for (const data of marketData) {
      const exists = await this.marketDataRepository.findOne({ where: { ticker: data.ticker } });
      if (!exists) {
        await this.marketDataRepository.save(data);
      }
    }

    // Seed company info
    const companyInfo = [
      { ticker: 'AAPL', company_name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', headquarters: 'Cupertino, CA', founded_date: new Date('1976-04-01') },
      { ticker: 'GOOGL', company_name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', headquarters: 'Mountain View, CA', founded_date: new Date('1998-09-04') },
      { ticker: 'MSFT', company_name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', headquarters: 'Redmond, WA', founded_date: new Date('1975-04-04') }
    ];

    for (const data of companyInfo) {
      const exists = await this.companyInfoRepository.findOne({ where: { ticker: data.ticker } });
      if (!exists) {
        await this.companyInfoRepository.save(data);
      }
    }
  }
}