import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataStore } from './data-store';
import { JsonStoreService } from './json-store.service';
import { MongoStoreService } from './mongo-store.service';

@Global()
@Module({
  providers: [
    {
      provide: DataStore,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataStore => {
        const uri = config.get<string>('MONGODB_URI');
        if (uri) {
          Logger.log('Storage: MongoDB', 'StorageModule');
          return new MongoStoreService(uri, config.get<string>('MONGODB_DB'));
        }
        if (config.get('NODE_ENV') === 'production') {
          Logger.warn(
            'MONGODB_URI is not set: saving to local files, which most hosts delete on restart.',
            'StorageModule',
          );
        }
        const dir = config.get<string>('DATA_DIR') ?? 'data';
        Logger.log(`Storage: JSON files in ./${dir}`, 'StorageModule');
        return new JsonStoreService(dir);
      },
    },
  ],
  exports: [DataStore],
})
export class StorageModule {}
