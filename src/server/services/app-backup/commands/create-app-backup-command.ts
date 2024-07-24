import { AppQueries } from '@/server/queries/apps/apps.queries';
import { AppBackupCommandParams, IAppBackupCommand } from './types';
import { EventDispatcher } from '@/server/core/EventDispatcher';
import { Logger } from '@/server/core/Logger';
import { TranslatedError } from '@/server/utils/errors';
import { AppStatus } from '@/server/db/schema';

export class CreateAppBackupCommand implements IAppBackupCommand {
  private queries: AppQueries;
  private eventDispatcher: EventDispatcher;
  private executeOtherCommand: IAppBackupCommand['execute'];

  constructor(params: AppBackupCommandParams) {
    this.queries = params.queries;
    this.eventDispatcher = params.eventDispatcher;
    this.executeOtherCommand = params.executeOtherCommand;
  }

  private async sendEvent(appId: string, appStatusBeforeUpdate: AppStatus): Promise<void> {
    const { success, stdout } = await this.eventDispatcher.dispatchEventAsync({ type: 'app', command: 'backup', appid: appId, form: {} });

    if (success) {
      if (appStatusBeforeUpdate === 'running') {
        await this.executeOtherCommand('startApp', { appId });
      } else {
        await this.queries.updateApp(appId, { status: appStatusBeforeUpdate });
      }

      await this.queries.updateApp(appId, { status: 'running' });
    } else {
      Logger.error(`Failed to backup app ${appId}: ${stdout}`);
      await this.queries.updateApp(appId, { status: 'stopped' });
    }
  }

  async execute(params: { appId: string }): Promise<void> {
    const { appId } = params;
    const app = await this.queries.getApp(appId);

    if (!app) {
      throw new TranslatedError('APP_ERROR_APP_NOT_FOUND', { id: appId });
    }

    // Run script
    await this.queries.updateApp(appId, { status: 'backing_up' });

    void this.sendEvent(appId, app.status);
  }
}