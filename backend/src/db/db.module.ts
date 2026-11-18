import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DB, openDatabase } from './database';

const HANDLE = Symbol('DB_HANDLE');

@Injectable()
class DbCloser implements OnApplicationShutdown {
  constructor(
    @Inject(HANDLE) private readonly handle: { close: () => Promise<void> },
  ) {}
  async onApplicationShutdown() {
    await this.handle.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: HANDLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dataDir = config.get<string>('DATA_DIR') ?? 'data';
        return openDatabase({
          url: config.get<string>('DATABASE_URL'),
          dataDir: dataDir.startsWith('memory://')
            ? dataDir
            : `${dataDir}/pglite`,
        });
      },
    },
    {
      provide: DB,
      inject: [HANDLE],
      useFactory: (h: Awaited<ReturnType<typeof openDatabase>>) => h.db,
    },
    DbCloser,
  ],
  exports: [DB],
})
export class DbModule {}
