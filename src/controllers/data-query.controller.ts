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
    summary: 'Query specific data point for a company',
    description: 'Retrieve a specific data point for a company from the specified table'
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
    description: 'Data point retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL' },
        dataPoint: { type: 'string', example: 'revenue' },
        tableName: { type: 'string', example: 'financial_data' },
        value: { type: 'number', example: 394328000000 },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters'
  })
  @ApiResponse({
    status: 404,
    description: 'Data not found for the specified ticker'
  })
  async queryData(
    @Query(ValidationPipe) queryParams: QueryDataDto
  ) {
    const { ticker, dataPoint, tableName } = queryParams;
    return await this.dataQueryService.queryDataPoint(ticker, dataPoint, tableName);
  }

  @Post('seed')
  @ApiOperation({
    summary: 'Seed database with sample data',
    description: 'Populate the database with sample financial, market, and company data for testing'
  })
  @ApiResponse({
    status: 201,
    description: 'Database seeded successfully'
  })
  async seedDatabase() {
    await this.dataQueryService.seedData();
    return { message: 'Database seeded successfully' };
  }
}