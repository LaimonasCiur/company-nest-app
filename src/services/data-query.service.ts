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
      // Enhanced cache debugging
      this.logger.log(`Attempting cache lookup for key: ${cacheKey}`);

      // Try to get from cache first
      const cachedResult = await this.cacheManager.get(cacheKey);

      if (cachedResult) {
        this.logger.log(`✅ Cache HIT for key: ${cacheKey}`);
        this.logger.debug(`Cached data type: ${typeof cachedResult}, keys: ${Object.keys(cachedResult)}`);

        return {
          ...cachedResult,
          cached: true,
          cacheHit: true,
          timestamp: new Date().toISOString()
        };
      }

      this.logger.log(`❌ Cache MISS for key: ${cacheKey}`);

      // Execute business rules validation first (without value)
      const ruleContext: RuleContext = {
        ticker: ticker.toUpperCase(),
        dataPoint,
        tableName
      };

      const ruleResult = await this.businessRulesService.executeRules(ruleContext);

      if (!ruleResult.isValid) {
        throw new BadRequestException(ruleResult.message || 'Business rules validation failed');
      }

      // Get repository and validate data point
      const { repository, validColumns } = this.getRepositoryAndColumns(tableName);

      if (!validColumns.includes(dataPoint)) {
        throw new BadRequestException(
          `Invalid data point '${dataPoint}' for table '${tableName}'. Valid columns: ${validColumns.join(', ')}`
        );
      }

      // Query database
      this.logger.log(`Querying database for ${ticker}.${dataPoint} from ${tableName}`);
      const queryBuilder = repository.createQueryBuilder('entity');
      queryBuilder
        .select([`entity.${dataPoint}`, 'entity.ticker'])
        .where('entity.ticker = :ticker', { ticker: ticker.toUpperCase() });

      const result = await queryBuilder.getOne();

      if (!result) {
        throw new NotFoundException(`No data found for ticker '${ticker}' in table '${tableName}'`);
      }

      const rawValue = result[dataPoint];
      this.logger.log(`Raw value from DB: ${rawValue} (type: ${typeof rawValue})`);

      // Execute business rules with the actual value
      const ruleContextWithValue: RuleContext = {
        ...ruleContext,
        value: rawValue
      };

      const finalRuleResult = await this.businessRulesService.executeRules(ruleContextWithValue);

      // Prepare response data - make it serializable
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

      // Enhanced cache setting with debugging
      try {
        this.logger.log(`📦 Setting cache for key: ${cacheKey}`);
        this.logger.debug(`Data to cache: ${JSON.stringify(responseData, null, 2)}`);

        // Use explicit TTL in milliseconds (5 minutes = 300000ms)
        await this.cacheManager.set(cacheKey, responseData, 300000);

        this.logger.log(`✅ Successfully cached result for key: ${cacheKey}`);

        // Immediately verify the cache was set
        const verification = await this.cacheManager.get(cacheKey);
        if (verification) {
          this.logger.log(`✅ Cache verification successful for key: ${cacheKey}`);
        } else {
          this.logger.error(`❌ Cache verification FAILED for key: ${cacheKey}`);
        }

      } catch (cacheError) {
        this.logger.error(`❌ Failed to cache result for key: ${cacheKey}`, cacheError);
      }

      return responseData;

    } catch (error) {
      this.logger.error(`Error in queryDataPoint for ${cacheKey}:`, error);
      throw error;
    }
  }

  async clearCache(ticker?: string, dataPoint?: string, tableName?: string): Promise<{ message: string; clearedKeys?: string[] }> {
    if (ticker && dataPoint && tableName) {
      // Clear specific cache entry
      const cacheKey = this.generateCacheKey(ticker, dataPoint, tableName);
      try {
        await this.cacheManager.del(cacheKey);
        this.logger.log(`Cleared cache for key: ${cacheKey}`);
        return {
          message: `Cache cleared for ${ticker}.${dataPoint} from ${tableName}`,
          clearedKeys: [cacheKey]
        };
      } catch (error) {
        this.logger.error(`Failed to clear cache for key: ${cacheKey}`, error);
        throw error;
      }
    } else {
      // Clear all cache entries by deleting known patterns
      const clearedKeys: string[] = [];
      const tickers = ['AAPL', 'GOOGL', 'MSFT']; // Known tickers from seed data
      const tables = [
        { name: 'financial_data', columns: ['revenue', 'profit', 'assets', 'liabilities', 'employees'] },
        { name: 'market_data', columns: ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume'] },
        { name: 'company_info', columns: ['company_name', 'sector', 'industry', 'headquarters', 'founded_date'] }
      ];

      // Clear all known cache entries
      for (const tickerSymbol of tickers) {
        for (const table of tables) {
          for (const column of table.columns) {
            const cacheKey = this.generateCacheKey(tickerSymbol, column, table.name);
            try {
              await this.cacheManager.del(cacheKey);
              clearedKeys.push(cacheKey);
            } catch (error) {
              // Ignore errors for non-existent keys
              this.logger.debug(`Key not found during clear: ${cacheKey}`);
            }
          }
        }
      }

      this.logger.log(`Cleared ${clearedKeys.length} cache entries`);
      return {
        message: `Cleared ${clearedKeys.length} cache entries`,
        clearedKeys
      };
    }
  }

  async getCacheStats(): Promise<any> {
    // Note: cache-manager doesn't provide built-in stats, so we'll simulate some
    return {
      cacheEnabled: true,
      defaultTTL: 300000, // 5 minutes in milliseconds
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

    this.logger.log('Starting cache warmup...');

    for (const ticker of tickers) {
      for (const table of tables) {
        for (const column of table.columns) {
          try {
            await this.queryDataPoint(ticker, column, table.name);
            warmedEntries++;
            this.logger.debug(`Warmed cache for ${ticker}.${column} from ${table.name}`);
          } catch (error) {
            this.logger.warn(`Failed to warm cache for ${ticker}.${column} from ${table.name}: ${error.message}`);
          }
        }
      }
    }

    this.logger.log(`Cache warmup completed. Warmed ${warmedEntries} entries.`);
    return {
      message: 'Cache warmup completed',
      warmedEntries
    };
  }

  private generateCacheKey(ticker: string, dataPoint: string, tableName: string): string {
    // Ensure consistent casing and clean key generation
    const key = `query:${ticker.toUpperCase()}:${dataPoint.toLowerCase()}:${tableName.toLowerCase()}`;
    this.logger.debug(`Generated cache key: ${key}`);
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