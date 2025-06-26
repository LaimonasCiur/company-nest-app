import { Controller, Get, Query, Post, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DataQueryService } from '../services/data-query.service';
import { QueryDataDto } from '../dto/query-data.dto';

@ApiTags('Data Query')
@Controller('data')
export class DataQueryController {
  constructor(private readonly dataQueryService: DataQueryService) {}

  @Get('query')
  @ApiOperation({
    summary: 'Query specific data point for a company with business rules',
    description: 'Retrieve a specific data point for a company from the specified table with business rule validation and transformation'
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
}