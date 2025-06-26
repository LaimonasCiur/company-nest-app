import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { DataQueryController } from './controllers/data-query.controller';
import { DataQueryService } from './services/data-query.service';
import { BusinessRulesService } from './services/business-rule.service';
import { FinancialData } from './entities/financial-data.entity';
import { MarketData } from './entities/market-data.entity';
import { CompanyInfo } from './entities/company-info.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as sql from 'mssql';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Fixed cache configuration
    CacheModule.register({
      ttl: 300000, // TTL in milliseconds (5 minutes)
      max: 1000,
      isGlobal: true,
      store: 'memory', // Explicitly specify memory store
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const username = configService.get('DB_USERNAME');
        const password = configService.get('DB_PASSWORD');
        const database = configService.get('DB_DATABASE');

        if (!username || !password || !database) {
          throw new Error('Missing required database configuration: DB_USERNAME, DB_PASSWORD, or DB_DATABASE');
        }

        await createDatabaseIfNotExists(configService, database);

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
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([FinancialData, MarketData, CompanyInfo]),
  ],
  controllers: [DataQueryController],
  providers: [DataQueryService, BusinessRulesService],
})
export class AppModule implements OnModuleInit {
  constructor(
    @InjectRepository(FinancialData)
    private financialDataRepository: Repository<FinancialData>,
    @InjectRepository(MarketData)
    private marketDataRepository: Repository<MarketData>,
    @InjectRepository(CompanyInfo)
    private companyInfoRepository: Repository<CompanyInfo>,
  ) {}

  async onModuleInit() {
    await this.seedData();
  }

  private async seedData(): Promise<void> {
    try {
      // Seed Financial Data
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

    } catch (error) {
      console.error('Error during data seeding:', error.message);
    }
  }
}

async function createDatabaseIfNotExists(configService: ConfigService, targetDatabase: string): Promise<void> {
  const masterConfig = {
    user: configService.get('DB_USERNAME'),
    password: configService.get('DB_PASSWORD'),
    server: configService.get('DB_HOST'),
    port: parseInt(configService.get('DB_PORT', '1433'), 10),
    database: 'master',
    options: {
      encrypt: configService.get('DB_ENCRYPT', 'false') === 'true',
      trustServerCertificate: configService.get('DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',
      enableArithAbort: true,
    },
    connectionTimeout: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '30000'), 10),
    requestTimeout: parseInt(configService.get('DB_REQUEST_TIMEOUT', '30000'), 10),
  };

  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(masterConfig);

    const result = await pool.request().query(`
      SELECT name FROM sys.databases WHERE name = '${targetDatabase}'
    `);

    if (result.recordset.length === 0) {
      await pool.request().query(`CREATE DATABASE [${targetDatabase}]`);
    } else {
      console.log(`${targetDatabase} already exists.`);
    }

  } catch (error) {
    console.error('Error during database creation:', error.message);

    if (error.message.includes('ECONNREFUSED') || error.message.includes('Login failed')) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        if (pool) {
          await pool.close();
        }
        pool = await sql.connect(masterConfig);

        const result = await pool.request().query(`SELECT name FROM sys.databases WHERE name = '${targetDatabase}'`);

        if (result.recordset.length === 0) {
          await pool.request().query(`CREATE DATABASE [${targetDatabase}]`);
        } else {
          console.log(`${targetDatabase} already exists.`);
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError.message);
      }
    }
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError.message);
      }
    }
  }
}