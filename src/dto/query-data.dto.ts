import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDataDto {
  @ApiProperty({
    description: 'Company ticker symbol',
    example: 'AAPL'
  })
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @ApiProperty({
    description: 'Data point name (column name)',
    example: 'revenue'
  })
  @IsString()
  @IsNotEmpty()
  dataPoint: string;

  @ApiProperty({
    description: 'Table name to query from',
    example: 'financial_data',
    enum: ['financial_data', 'market_data', 'company_info']
  })
  @IsString()
  @IsNotEmpty()
  tableName: string;
}