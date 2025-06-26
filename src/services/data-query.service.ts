import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialData } from '../entities/financial-data.entity';
import { MarketData } from '../entities/market-data.entity';
import { CompanyInfo } from '../entities/company-info.entity';
import { BusinessRulesService } from './business-rule.service';
import { RuleContext } from '../interfaces/business-rule-context';

@Injectable()
export class DataQueryService {
  constructor(
    @InjectRepository(FinancialData)
    private financialDataRepository: Repository<FinancialData>,
    @InjectRepository(MarketData)
    private marketDataRepository: Repository<MarketData>,
    @InjectRepository(CompanyInfo)
    private companyInfoRepository: Repository<CompanyInfo>,
    private businessRulesService: BusinessRulesService,
  ) {}

  async queryDataPoint(ticker: string, dataPoint: string, tableName: string): Promise<any> {
    const ruleContext: RuleContext = {
      ticker: ticker.toUpperCase(),
      dataPoint,
      tableName
    };

    const ruleResult = await this.businessRulesService.executeRules(ruleContext);

    if (!ruleResult.isValid) {
      throw new BadRequestException(ruleResult.message || 'Business rules validation failed');
    }

    const { repository, validColumns } = this.getRepositoryAndColumns(tableName);

    if (!validColumns.includes(dataPoint)) {
      throw new BadRequestException(
        `Invalid data point '${dataPoint}' for table '${tableName}'. Valid columns: ${validColumns.join(', ')}`
      );
    }

    const queryBuilder = repository.createQueryBuilder('entity');
    queryBuilder
      .select([`entity.${dataPoint}`, 'entity.ticker'])
      .where('entity.ticker = :ticker', { ticker: ticker.toUpperCase() });

    const result = await queryBuilder.getOne();

    if (!result) {
      throw new NotFoundException(`No data found for ticker '${ticker}' in table '${tableName}'`);
    }

    const rawValue = result[dataPoint];

    const ruleContextWithValue: RuleContext = {
      ...ruleContext,
      value: rawValue
    };

    const finalRuleResult = await this.businessRulesService.executeRules(ruleContextWithValue);

    return {
      ticker: result.ticker,
      dataPoint,
      tableName,
      value: finalRuleResult.transformedValue !== undefined ? finalRuleResult.transformedValue : rawValue,
      originalValue: rawValue,
      businessRule: {
        message: finalRuleResult.message,
        applied: finalRuleResult.transformedValue !== undefined,
        appliedRules: finalRuleResult.appliedRules || []
      },
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
}