import { Injectable, BadRequestException, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FinancialData } from '../entities/financial-data.entity';
import { MarketData } from '../entities/market-data.entity';
import { CompanyInfo } from '../entities/company-info.entity';
import { BusinessRulesService } from './business-rule.service';
import { RuleContext } from '../interfaces/business-rule-context';

@Injectable()
export class DataQueryService {
  private readonly logger = new Logger(DataQueryService.name);

  constructor(
    @InjectRepository(FinancialData)
    private financialDataRepository: Repository<FinancialData>,
    @InjectRepository(MarketData)
    private marketDataRepository: Repository<MarketData>,
    @InjectRepository(CompanyInfo)
    private companyInfoRepository: Repository<CompanyInfo>,
    private businessRulesService: BusinessRulesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async queryDataPoint(ticker: string, dataPoint: string, tableName: string): Promise<any> {
    const cacheKey = this.generateCacheKey(ticker, dataPoint, tableName);

    try {
      const cachedResult = await this.cacheManager.get(cacheKey);

      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true,
          cacheHit: true,
          timestamp: new Date().toISOString()
        };
      }

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

      const responseData = {
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
        cached: false,
        cacheHit: false,
        timestamp: new Date().toISOString()
      };

      try {
        await this.cacheManager.set(cacheKey, responseData, 300000);
        await this.cacheManager.get(cacheKey);
      } catch (cacheError) {
      }

      return responseData;

    } catch (error) {
      throw error;
    }
  }

  async clearCache(ticker?: string, dataPoint?: string, tableName?: string): Promise<{ message: string; clearedKeys?: string[] }> {
    if (ticker && dataPoint && tableName) {
      const cacheKey = this.generateCacheKey(ticker, dataPoint, tableName);
      try {
        await this.cacheManager.del(cacheKey);
        return {
          message: `Cache cleared for ${ticker}.${dataPoint} from ${tableName}`,
          clearedKeys: [cacheKey]
        };
      } catch (error) {
        throw error;
      }
    } else {
      const clearedKeys: string[] = [];
      const tickers = ['AAPL', 'GOOGL', 'MSFT'];
      const tables = [
        { name: 'financial_data', columns: ['revenue', 'profit', 'assets', 'liabilities', 'employees'] },
        { name: 'market_data', columns: ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume'] },
        { name: 'company_info', columns: ['company_name', 'sector', 'industry', 'headquarters', 'founded_date'] }
      ];

      for (const tickerSymbol of tickers) {
        for (const table of tables) {
          for (const column of table.columns) {
            const cacheKey = this.generateCacheKey(tickerSymbol, column, table.name);
            try {
              await this.cacheManager.del(cacheKey);
              clearedKeys.push(cacheKey);
            } catch (error) {
            }
          }
        }
      }

      return {
        message: `Cleared ${clearedKeys.length} cache entries`,
        clearedKeys
      };
    }
  }

  async getCacheStats(): Promise<any> {
    return {
      cacheEnabled: true,
      defaultTTL: 300000,
      maxItems: 1000,
      message: 'Cache is active and configured'
    };
  }

  async warmupCache(): Promise<{ message: string; warmedEntries: number }> {
    const tickers = ['AAPL', 'GOOGL', 'MSFT'];
    const tables = [
      { name: 'financial_data', columns: ['revenue', 'profit', 'assets', 'liabilities', 'employees'] },
      { name: 'market_data', columns: ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume'] },
      { name: 'company_info', columns: ['company_name', 'sector', 'industry', 'headquarters', 'founded_date'] }
    ];

    let warmedEntries = 0;

    for (const ticker of tickers) {
      for (const table of tables) {
        for (const column of table.columns) {
          try {
            await this.queryDataPoint(ticker, column, table.name);
            warmedEntries++;
          } catch (error) {
          }
        }
      }
    }

    return {
      message: 'Cache warmup completed',
      warmedEntries
    };
  }

  private generateCacheKey(ticker: string, dataPoint: string, tableName: string): string {
    const key = `query:${ticker.toUpperCase()}:${dataPoint.toLowerCase()}:${tableName.toLowerCase()}`;
    return key;
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