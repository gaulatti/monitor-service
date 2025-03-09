import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Constructs the JWKS URI for a given AWS Cognito region and user pool ID.
 *
 * @param region - The AWS region where the Cognito user pool is located.
 * @param poolId - The ID of the Cognito user pool.
 * @returns The JWKS URI as a string.
 */
const buildJwksUri = (region: string, poolId: string) =>
  `https://cognito-idp.${region}.amazonaws.com/${poolId}`;

/**
 * Authorization strategy for handling JWT authentication using Passport.
 *
 * This strategy extracts the JWT from the Authorization header as a Bearer token,
 * retrieves the JWKS (JSON Web Key Set) from a specified URI, and validates the JWT
 * using the RS256 algorithm.
 *
 * @class
 * @extends {PassportStrategy(Strategy)}
 *
 * @param {ConfigService} configService - The configuration service used to retrieve necessary configuration values.
 *
 * @example
 * // Example usage:
 * const strategy = new AuthorizationStrategy(configService);
 *
 * @method constructor
 * @param {ConfigService} configService - The configuration service used to retrieve necessary configuration values.
 *
 * @method validate
 * @param {any} payload - The payload containing user information to be validated and updated.
 * @returns {any} The updated user information.
 */
@Injectable()
export class AuthorizationStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructs an instance of the authorization strategy.
   *
   * @param {ConfigService} configService - The configuration service to retrieve environment variables.
   *
   * The constructor initializes the JWT strategy with the following options:
   * - `jwtFromRequest`: Extracts the JWT from the Authorization header as a Bearer token.
   * - `secretOrKeyProvider`: Configures the JWKS (JSON Web Key Set) provider with caching, rate limiting, and the JWKS URI.
   * - `issuer`: Sets the issuer URL for the JWT.
   * - `algorithms`: Specifies the allowed algorithms for JWT validation (RS256).
   *
   * The JWKS URI and issuer URL are built using the AWS region and Cognito user pool ID from the configuration service.
   */
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${buildJwksUri(
          configService.get<string>('AWS_REGION') as string,
          configService.get<string>('COGNITO_USER_POOL_ID') as string,
        )}/.well-known/jwks.json`,
      }),
      issuer: buildJwksUri(
        configService.get<string>('AWS_REGION') as string,
        configService.get<string>('COGNITO_USER_POOL_ID') as string,
      ),
      algorithms: ['RS256'],
    });
  }

  /**
   * Validates the given payload.
   *
   * @param payload - The payload to validate.
   * @returns The validated payload.
   */
  validate(payload: any) {
    return payload as object;
  }
}
