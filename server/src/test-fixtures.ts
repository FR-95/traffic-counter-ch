// Gekürzte DATEX-II-Antworten im Format von opentransportdata.swiss für Tests.

const envelope = (payload: string) => `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dx223="http://datex2.eu/schema/2/2_0">
<SOAP-ENV:Body><dx223:d2LogicalModel modelBaseVersion="2">
<dx223:payloadPublication xsi:type="dx223:MeasuredDataPublication" lang="en">
<dx223:publicationTime>2026-10-27T07:24:18Z</dx223:publicationTime>
${payload}
</dx223:payloadPublication></dx223:d2LogicalModel></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

const characteristic = (index: string, type: string, vehicle: string) => `
<dx223:measurementSpecificCharacteristics index="${index}"><dx223:measurementSpecificCharacteristics>
<dx223:specificMeasurementValueType>${type}</dx223:specificMeasurementValueType>
<dx223:specificVehicleCharacteristics><dx223:vehicleType>${vehicle}</dx223:vehicleType></dx223:specificVehicleCharacteristics>
</dx223:measurementSpecificCharacteristics></dx223:measurementSpecificCharacteristics>`;

const record = (id: string, direction: string, lane: string, location: number, carriageway = 'mainCarriageway') => `
<dx223:measurementSiteRecord xsi:type="dx223:MeasurementSiteRecord" id="${id}" version="1">
${characteristic('11', 'trafficFlow', 'car')}${characteristic('12', 'trafficSpeed', 'car')}
${characteristic('21', 'trafficFlow', 'lorry')}${characteristic('22', 'trafficSpeed', 'lorry')}
<dx223:measurementSiteLocation xsi:type="dx223:Point">
<dx223:supplementaryPositionalDescription><dx223:affectedCarriagewayAndLanes>
<dx223:carriageway>${carriageway}</dx223:carriageway><dx223:lane>${lane}</dx223:lane>
</dx223:affectedCarriagewayAndLanes></dx223:supplementaryPositionalDescription>
<dx223:alertCPoint xsi:type="dx223:AlertCMethod4Point">
<dx223:alertCDirection><dx223:alertCDirectionCoded>${direction}</dx223:alertCDirectionCoded></dx223:alertCDirection>
<dx223:alertCMethod4PrimaryPointLocation><dx223:alertCLocation>
<dx223:specificLocation>${location}</dx223:specificLocation>
</dx223:alertCLocation><dx223:offsetDistance><dx223:offsetDistance>0</dx223:offsetDistance></dx223:offsetDistance>
</dx223:alertCMethod4PrimaryPointLocation></dx223:alertCPoint>
<dx223:pointByCoordinates><dx223:pointCoordinates>
<dx223:latitude>46.96</dx223:latitude><dx223:longitude>7.47</dx223:longitude>
</dx223:pointCoordinates></dx223:pointByCoordinates>
</dx223:measurementSiteLocation></dx223:measurementSiteRecord>`;

export const siteTableXml = envelope(`<dx223:measurementSiteTable id="OTD:TrafficData" version="31">
${record('CH:0001.01', 'positive', 'lane1', 100)}
${record('CH:0001.02', 'negative', 'lane1', 100)}
${record('CH:0002.01', 'positive', 'lane2', 999)}
${record('CH:0002.02', 'positive', 'lane1', 999, 'exitSlipRoad')}
</dx223:measurementSiteTable>`);

const value = (index: string, inner: string) =>
  `<dx223:measuredValue index="${index}"><dx223:measuredValue><dx223:basicData>${inner}</dx223:basicData></dx223:measuredValue></dx223:measuredValue>`;
const flow = (index: string, rate: number) =>
  value(index, `<dx223:vehicleFlow><dx223:vehicleFlowRate>${rate}</dx223:vehicleFlowRate></dx223:vehicleFlow>`);
const speed = (index: string, kmh: string) =>
  value(index, `<dx223:averageVehicleSpeed numberOfInputValuesUsed="10"><dx223:speed>${kmh}</dx223:speed></dx223:averageVehicleSpeed>`);
const site = (id: string, values: string) => `<dx223:siteMeasurements>
<dx223:measurementSiteReference targetClass="MeasurementSiteRecord" id="${id}" version="1"/>
<dx223:measurementTimeDefault>2026-10-27T07:23:00Z</dx223:measurementTimeDefault>${values}</dx223:siteMeasurements>`;

export const measurementsXml = envelope(`
<dx223:measurementSiteTableReference targetClass="MeasurementSiteTable" id="OTD:TrafficData" version="31"/>
${site('CH:0001.01', flow('11', 600) + speed('12', '100.00') + flow('21', 200) + speed('22', '80.00'))}
${site('CH:0001.02', value('0', '<dx223:vehicleFlow><dx223:dataError>true</dx223:dataError><dx223:reasonForDataError><dx223:values><dx223:value lang="en">VD_OFFLINE</dx223:value></dx223:values></dx223:reasonForDataError><dx223:vehicleFlowRate>0</dx223:vehicleFlowRate></dx223:vehicleFlow>'))}
${site('CH:0002.01', flow('11', 0) + flow('21', 0))}
${site('CH:0002.02', flow('11', 120) + speed('12', '40.00'))}
${site('CH:9999.01', flow('11', 10))}`);
