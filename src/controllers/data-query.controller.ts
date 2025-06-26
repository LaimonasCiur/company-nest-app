import { Controller, Get, Query, Post, Delete, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DataQueryService } from '../services/data-query.service';
import { BusinessRulesService } from '../services/business-rule.service';
import { QueryDataDto } from '../dto/query-data.dto';

@ApiTags('Data Query')
@Controller('data')
export class DataQueryController {
  constructor(
    private readonly dataQueryService: DataQueryService,
    private readonly businessRulesService: BusinessRulesService,
  ) {}

  @Get('query')
  @ApiOperation({
    summary: 'Query specific data point for a company with business rules',
    description: 'Retrieve a specific data point for a company from the specified table with business rule validation and transformation. Results are cached for improved performance.'
  })
  @ApiQuery({
    name: 'ticker',
    description: 'Company ticker symbol',
    example: 'AAPL'
  })
  @ApiQuery({
    name: 'dataPoint',
    description: 'Data point name (column name)',
    example: 'revenue'
  })
  @ApiQuery({
    name: 'tableName',
    description: 'Table name to query from',
    example: 'financial_data'
  })
  @ApiResponse({
    status: 200,
    description: 'Data point retrieved successfully with business rules applied',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL' },
        dataPoint: { type: 'string', example: 'revenue' },
        tableName: { type: 'string', example: 'financial_data' },
        value: {
          oneOf: [
            { type: 'number', example: 394328000000 },
            {
              type: 'object',
              properties: {
                original: { type: 'number', example: 394328000000 },
                billions: { type: 'number', example: 394.33 },
                formatted: { type: 'string', example: '$394.33B' }
              }
            }
          ]
        },
        originalValue: { type: 'number', example: 394328000000 },
        businessRule: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Large cap company detected - revenue over $1T' },
            applied: { type: 'boolean', example: true },
            appliedRules: {
              type: 'array',
              items: { type: 'string' },
              example: ['validate-ticker', 'table-access-granted', 'transform-to-billions', 'large-cap-company']
            }
          }
        },
        cached: { type: 'boolean', example: false },
        cacheHit: { type: 'boolean', example: false },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters or business rules validation failed'
  })
  @ApiResponse({
    status: 404,
    description: 'Data not found for the specified ticker'
  })
  async queryData(
    @Query(new ValidationPipe({ transform: true })) queryParams: QueryDataDto
  ) {
    const { ticker, dataPoint, tableName } = queryParams;
    return await this.dataQueryService.queryDataPoint(ticker, dataPoint, tableName);
  }

  @Get('rules/info')
  @ApiOperation({
    summary: 'Get information about active business rules',
    description: 'Returns information about the currently configured business rules'
  })
  @ApiResponse({
    status: 200,
    description: 'Business rules information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        rulesCount: { type: 'number', example: 8 },
        ruleTypes: {
          type: 'array',
          items: { type: 'string' },
          example: ['ticker-validation', 'table-access-validation', 'large-number-transformation', 'large-cap-company-detection']
        }
      }
    }
  })
  async getRulesInfo() {
    return {
      rulesCount: 8,
      ruleTypes: [
        'ticker-validation',
        'table-access-validation',
        'large-number-transformation',
        'large-cap-company-detection',
        'mega-corporation-detection',
        'high-pe-ratio-detection',
        'penny-stock-detection'
      ]
    };
  }

  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Returns information about the current cache configuration and status'
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        cacheEnabled: { type: 'boolean', example: true },
        defaultTTL: { type: 'number', example: 300 },
        maxItems: { type: 'number', example: 1000 },
        message: { type: 'string', example: 'Cache is active and configured' }
      }
    }
  })
  async getCacheStats() {
    return await this.dataQueryService.getCacheStats();
  }

  @Post('cache/warmup')
  @ApiOperation({
    summary: 'Warm up the cache',
    description: 'Pre-populate the cache with commonly requested data points to improve performance'
  })
  @ApiResponse({
    status: 200,
    description: 'Cache warmup completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cache warmup completed' },
        warmedEntries: { type: 'number', example: 45 }
      }
    }
  })
  async warmupCache() {
    return await this.dataQueryService.warmupCache();
  }

  @Delete('cache/clear')
  @ApiOperation({
    summary: 'Clear cache entries',
    description: 'Clear specific cache entries or all cache entries'
  })
  @ApiQuery({
    name: 'ticker',
    description: 'Company ticker symbol (optional - for specific cache clearing)',
    example: 'AAPL',
    required: false
  })
  @ApiQuery({
    name: 'dataPoint',
    description: 'Data point name (optional - for specific cache clearing)',
    example: 'revenue',
    required: false
  })
  @ApiQuery({
    name: 'tableName',
    description: 'Table name (optional - for specific cache clearing)',
    example: 'financial_data',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cache cleared for AAPL.revenue from financial_data' },
        clearedKeys: {
          type: 'array',
          items: { type: 'string' },
          example: ['query:AAPL:revenue:financial_data']
        }
      }
    }
  })
  async clearCache(
    @Query('ticker') ticker?: string,
    @Query('dataPoint') dataPoint?: string,
    @Query('tableName') tableName?: string
  ) {
    return await this.dataQueryService.clearCache(ticker, dataPoint, tableName);
  }

  @Delete('cache/rules/clear')
  @ApiOperation({
    summary: 'Clear business rules cache',
    description: 'Clear cached business rule execution results'
  })
  @ApiQuery({
    name: 'ticker',
    description: 'Company ticker symbol (optional - for specific rule cache clearing)',
    example: 'AAPL',
    required: false
  })
  @ApiQuery({
    name: 'dataPoint',
    description: 'Data point name (optional - for specific rule cache clearing)',
    example: 'revenue',
    required: false
  })
  @ApiQuery({
    name: 'tableName',
    description: 'Table name (optional - for specific rule cache clearing)',
    example: 'financial_data',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Rules cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Rule cache cleared for AAPL.revenue from financial_data' },
        clearedKeys: {
          type: 'array',
          items: { type: 'string' },
          example: ['rules:AAPL:revenue:financial_data:no-value', 'rules:AAPL:revenue:financial_data:null']
        }
      }
    }
  })
  async clearRulesCache(
    @Query('ticker') ticker?: string,
    @Query('dataPoint') dataPoint?: string,
    @Query('tableName') tableName?: string
  ) {
    return await this.businessRulesService.clearRuleCache(ticker, dataPoint, tableName);
  }
}