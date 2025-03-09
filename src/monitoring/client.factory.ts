import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { Logger } from 'src/decorators/logger.decorator';
import { JSONLogger } from 'src/utils/logger';

export interface OrchestratorService {
  triggerPlaylist(
    data: { slug: string; context: any; origin: string },
    callback: (err: any, res: { slug: string; status: string }) => void,
  ): void;
}

@Injectable()
export class ClientFactory {
  /**
   * Logger instance for logging messages.
   */
  @Logger(ClientFactory.name)
  private readonly logger!: JSONLogger;

  /**
   * Creates a gRPC client for the specified service.
   *
   * @template T - The type of the gRPC client.
   * @param {string} host - The host address of the gRPC server.
   * @param {number} port - The port number of the gRPC server.
   * @param {string} protoFile - The name of the proto file defining the service.
   * @param {string} packageName - The package name defined in the proto file.
   * @param {string} serviceName - The service name defined in the proto file.
   * @returns {T} - An instance of the gRPC client.
   */
  createClient<T>(
    host: string,
    port: number,
    protoFile: string,
    packageName: string,
    serviceName: string,
  ): T | null {
    try {
      const protoPath = join(__dirname, 'proto', protoFile);

      const packageDefinition = loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const grpcObject = loadPackageDefinition(packageDefinition) as any;
      const service = grpcObject?.[packageName]?.[serviceName];

      if (!service) {
        throw new Error(
          `gRPC service '${serviceName}' not found in package '${packageName}'. Check your .proto file and imports.`,
        );
      }

      const client = new service(
        `${host}:${port}`,
        credentials.createInsecure(),
      );

      client.waitForReady(Date.now() + 5000, (err: { message: any }) => {
        if (err) {
          this.logger.error(
            `⚠️ gRPC Client for ${serviceName} (${host}:${port}) failed to connect: ${err.message}`,
          );
        }
      });

      return client as T;
    } catch (error) {
      this.logger.error(`❌ Error creating gRPC client: ${error.message}`);
      return null;
    }
  }
}
