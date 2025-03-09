import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DalModule } from 'src/dal/dal.module';
import { AuthorizationStrategy } from './authorization.strategy';

/**
 * The AuthorizationModule is responsible for handling authorization-related functionality.
 *
 * @module AuthorizationModule
 *
 * @imports
 * - DalModule: Data Access Layer module for database interactions.
 * - PassportModule: Passport module configured with JWT strategy for authentication.
 * - JwtModule: JWT module for handling JSON Web Tokens.
 *
 * @providers
 * - AuthorizationStrategy: Strategy for handling authorization logic.
 *
 * @exports
 * - AuthorizationStrategy: Exported to be used in other modules.
 */
@Module({
  imports: [
    DalModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  providers: [AuthorizationStrategy],
  exports: [AuthorizationStrategy],
})
export class AuthorizationModule {}
