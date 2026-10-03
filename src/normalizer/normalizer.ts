import { AccountingTransaction, AccountingSoftware } from './commonModel';
import { TallyConnector } from '../connectors/tallyConnector';
import { ZohoBooksConnector } from '../connectors/zohoConnector';

/**
 * Universal dispatcher to normalize data based on software selection
 */
export async function normalizeAccountingData(
  fileContent: string | ArrayBuffer,
  fileName: string,
  software: AccountingSoftware,
  companyName: string
): Promise<AccountingTransaction[]> {
  if (software === 'TallyPrime') {
    return await TallyConnector.parseFile(fileContent, fileName, companyName);
  } else {
    return await ZohoBooksConnector.parseFile(fileContent, fileName, companyName);
  }
}
