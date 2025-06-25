import { Injectable, Logger } from '@nestjs/common';
import { Engine, Rule } from 'json-rules-engine';
import { RuleContext } from '../interfaces/business-rule-context';
import { RuleResult } from '../interfaces/business-rule-result';

@Injectable()
export class BusinessRulesService {
  private readonly logger = new Logger(BusinessRulesService.name);
  private engine: Engine;

  constructor() {
    this.initializeEngine();
  }

  private initializeEngine() {
    this.engine = new Engine();
    this.setupValidationRules();
    this.setupTransformationRules();
    this.setupBusinessLogicRules();
  }

  private setupValidationRules() {
    const tickerValidationRule = new Rule({
      conditions: {
        all: [{
          fact: 'ticker',
          operator: 'notEqual',
          value: null
        }]
      },
      event: {
        type: 'validate-ticker',
        params: {
          message: 'Validating ticker format'
        }
      }
    });

    const tableAccessRule = new Rule({
      conditions: {
        any: [
          {
            all: [
              { fact: 'tableName', operator: 'equal', value: 'financial_data' },
              { fact: 'dataPoint', operator: 'in', value: ['revenue', 'profit', 'assets', 'liabilities', 'employees'] }
            ]
          },
          {
            all: [
              { fact: 'tableName', operator: 'equal', value: 'market_data' },
              { fact: 'dataPoint', operator: 'in', value: ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume'] }
            ]
          },
          {
            all: [
              { fact: 'tableName', operator: 'equal', value: 'company_info' },
              { fact: 'dataPoint', operator: 'in', value: ['company_name', 'sector', 'industry', 'headquarters', 'founded_date'] }
            ]
          }
        ]
      },
      event: {
        type: 'table-access-granted',
        params: {
          message: 'Table access granted'
        }
      }
    });

    this.engine.addRule(tickerValidationRule);
    this.engine.addRule(tableAccessRule);
  }

  private setupTransformationRules() {
    const largeNumberTransformRule = new Rule({
      conditions: {
        all: [
          { fact: 'value', operator: 'notEqual', value: null },
          { fact: 'value', operator: 'notEqual', value: undefined },
          { fact: 'value', operator: 'greaterThan', value: 1000000000 },
          { fact: 'dataPoint', operator: 'in', value: ['revenue', 'market_cap', 'assets', 'liabilities'] }
        ]
      },
      event: {
        type: 'transform-to-billions',
        params: {
          message: 'Transforming large number to billions format'
        }
      }
    });

    this.engine.addRule(largeNumberTransformRule);
  }

  private setupBusinessLogicRules() {
    const largeCorporationRule = new Rule({
      conditions: {
        all: [
          { fact: 'value', operator: 'notEqual', value: null },
          { fact: 'value', operator: 'notEqual', value: undefined },
          { fact: 'tableName', operator: 'equal', value: 'financial_data' },
          { fact: 'dataPoint', operator: 'equal', value: 'revenue' },
          { fact: 'value', operator: 'greaterThan', value: 1000000000000 }
        ]
      },
      event: {
        type: 'large-cap-company',
        params: {
          message: 'Large cap company detected - revenue over $1T'
        }
      }
    });

    const megaCorporationRule = new Rule({
      conditions: {
        all: [
          { fact: 'value', operator: 'notEqual', value: null },
          { fact: 'value', operator: 'notEqual', value: undefined },
          { fact: 'tableName', operator: 'equal', value: 'financial_data' },
          { fact: 'dataPoint', operator: 'equal', value: 'employees' },
          { fact: 'value', operator: 'greaterThan', value: 500000 }
        ]
      },
      event: {
        type: 'mega-corporation',
        params: {
          message: 'Mega corporation - over 500k employees'
        }
      }
    });

    const highPERatioRule = new Rule({
      conditions: {
        all: [
          { fact: 'value', operator: 'notEqual', value: null },
          { fact: 'value', operator: 'notEqual', value: undefined },
          { fact: 'tableName', operator: 'equal', value: 'market_data' },
          { fact: 'dataPoint', operator: 'equal', value: 'pe_ratio' },
          { fact: 'value', operator: 'greaterThan', value: 50 }
        ]
      },
      event: {
        type: 'high-pe-ratio',
        params: {
          message: 'High P/E ratio detected - potentially overvalued'
        }
      }
    });

    const pennyStockRule = new Rule({
      conditions: {
        all: [
          { fact: 'value', operator: 'notEqual', value: null },
          { fact: 'value', operator: 'notEqual', value: undefined },
          { fact: 'tableName', operator: 'equal', value: 'market_data' },
          { fact: 'dataPoint', operator: 'equal', value: 'stock_price' },
          { fact: 'value', operator: 'lessThan', value: 1 }
        ]
      },
      event: {
        type: 'penny-stock',
        params: {
          message: 'Penny stock detected'
        }
      }
    });

    this.engine.addRule(largeCorporationRule);
    this.engine.addRule(megaCorporationRule);
    this.engine.addRule(highPERatioRule);
    this.engine.addRule(pennyStockRule);
  }

  async executeRules(context: RuleContext): Promise<RuleResult> {
    try {
      this.logger.log(`Executing rules for: ${context.ticker}.${context.dataPoint} from ${context.tableName}`);

      if (!this.isValidTicker(context.ticker)) {
        return {
          isValid: false,
          message: 'Invalid ticker format. Must be 1-5 uppercase letters.',
          appliedRules: ['ticker-validation-failed']
        };
      }

      const contextWithDefaults = {
        ...context,
        value: context.value ?? null
      };

      const results = await this.engine.run(contextWithDefaults);

      const tableAccessGranted = results.events.some(event => event.type === 'table-access-granted');

      if (!tableAccessGranted) {
        return {
          isValid: false,
          message: this.getTableAccessError(context.tableName, context.dataPoint),
          appliedRules: ['table-access-denied']
        };
      }

      let transformedValue = context.value;
      const messages: string[] = [];
      const appliedRules: string[] = [];

      for (const event of results.events) {
        appliedRules.push(event.type);

        switch (event.type) {
          case 'transform-to-billions':
            if (context.value !== null && context.value !== undefined) {
              transformedValue = this.transformToBillions(context.value);
            }
            if (event.params?.message) {
              messages.push(event.params.message);
            }
            break;

          case 'large-cap-company':
          case 'mega-corporation':
          case 'high-pe-ratio':
          case 'penny-stock':
            if (event.params?.message) {
              messages.push(event.params.message);
            }
            break;
        }
      }

      this.logger.log(`Rules execution completed. Applied rules: ${appliedRules.join(', ')}`);

      return {
        isValid: true,
        message: messages.length > 0 ? messages.join('; ') : 'No specific business rules applied',
        transformedValue: transformedValue !== context.value ? transformedValue : undefined,
        appliedRules
      };

    } catch (error) {
      this.logger.error('Error executing business rules:', error);
      return {
        isValid: false,
        message: 'Error executing business rules: ' + error.message,
        appliedRules: ['execution-error']
      };
    }
  }

  private isValidTicker(ticker: string): boolean {
    return /^[A-Z]{1,5}$/.test(ticker.toUpperCase());
  }

  private getTableAccessError(tableName: string, dataPoint: string): string {
    const tableRules = {
      'financial_data': ['revenue', 'profit', 'assets', 'liabilities', 'employees'],
      'market_data': ['stock_price', 'market_cap', 'pe_ratio', 'dividend_yield', 'volume'],
      'company_info': ['company_name', 'sector', 'industry', 'headquarters', 'founded_date']
    };

    const validColumns = tableRules[tableName];
    return `Invalid data point '${dataPoint}' for table '${tableName}'. Valid columns: ${validColumns?.join(', ') || 'none'}`;
  }

  private transformToBillions(value: number): any {
    return {
      original: value,
      billions: Math.round(value / 1000000000 * 100) / 100,
      formatted: `$${Math.round(value / 1000000000 * 100) / 100}B`
    };
  }
}