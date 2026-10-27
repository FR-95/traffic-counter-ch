export type PullAction = 'pullMeasuredData' | 'pullMeasurementSiteTable';

const SOAP_ACTION_BASE = 'http://opentransportdata.swiss/TDP/Soap_Datex2/Pull/v1/';

const REQUEST_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dx223="http://datex2.eu/schema/2/2_0">
  <SOAP-ENV:Body>
    <dx223:d2LogicalModel xsi:type="dx223:D2LogicalModel" modelBaseVersion="2">
      <dx223:exchange xsi:type="dx223:Exchange">
        <dx223:supplierIdentification xsi:type="dx223:InternationalIdentifier">
          <dx223:country xsi:type="dx223:CountryEnum">ch</dx223:country>
          <dx223:nationalIdentifier xsi:type="dx223:String">FEDRO</dx223:nationalIdentifier>
        </dx223:supplierIdentification>
      </dx223:exchange>
    </dx223:d2LogicalModel>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

export interface OtdClientOptions {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
}

export function createOtdClient({ endpoint, apiKey, timeoutMs = 60_000 }: OtdClientOptions) {
  return async function pull(action: PullAction): Promise<string> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Authorization: apiKey,
        SOAPAction: SOAP_ACTION_BASE + action,
      },
      body: REQUEST_BODY,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${action}: HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  };
}
