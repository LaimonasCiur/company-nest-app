import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataQueryController } from './controllers/data-query.controller';
import { DataQueryService } from './services/data-query.service';
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
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 1433),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [FinancialData, MarketData, CompanyInfo],
        synchronize: configService.get('NODE_ENV') !== 'production', // Set to false in production
        logging: configService.get('NODE_ENV') === 'development',
        options: {
          encrypt: configService.get('DB_ENCRYPT', 'true') === 'true', // Required for Azure SQL
          trustServerCertificate: configService.get('DB_TRUST_SERVER_CERTIFICATE', 'false') === 'true', // For local dev
          enableArithAbort: true,
          connectionTimeout: 30000,
          requestTimeout: 30000,
        },
        extra: {
          validateParameters: false,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([FinancialData, MarketData, CompanyInfo]),
  ],
  controllers: [DataQueryController],
  providers: [DataQueryService],
})
export class AppModule {}