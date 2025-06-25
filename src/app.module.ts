import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataQueryController } from './controllers/data-query.controller';
import { DataQueryService } from './services/data-query.service';
import { BusinessRulesService } from './services/business-rule.service';
import { FinancialData } from './entities/financial-data.entity';
import { MarketData } from './entities/market-data.entity';
import { CompanyInfo } from './entities/company-info.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {

        const username = configService.get('DB_USERNAME');
        const password = configService.get('DB_PASSWORD');
        const database = configService.get('DB_DATABASE');

        if (!username || !password || !database) {
          throw new Error('Missing required database configuration: DB_USERNAME, DB_PASSWORD, or DB_DATABASE');
        }

        return {
          type: 'mssql',
          host: configService.get('DB_HOST'),
          port: parseInt(configService.get('DB_PORT', '1433'), 10),
          username: username,
          password: password,
          database: database,
          entities: [FinancialData, MarketData, CompanyInfo],
          synchronize: configService.get('NODE_ENV') !== 'production',
          logging: configService.get('NODE_ENV') === 'development',
          options: {
            encrypt: configService.get('DB_ENCRYPT', 'false') === 'true',
            trustServerCertificate: configService.get('DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',
            enableArithAbort: true,
            connectionTimeout: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '30000'), 10),
            requestTimeout: parseInt(configService.get('DB_REQUEST_TIMEOUT', '30000'), 10),
          },
          extra: {
            validateParameters: false,
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([FinancialData, MarketData, CompanyInfo]),
  ],
  controllers: [DataQueryController],
  providers: [DataQueryService, BusinessRulesService],
})
export class AppModule {}