export type AddressInput={street:string;city:string;state:string;postalCode:string};
export type AddressStatus='match'|'multiple'|'no_match'|'unavailable';
export class AddressInputFailure extends Error {status:number;}
export function addressInput(raw:unknown):AddressInput;
export function checkAddress(raw:unknown,transport?:typeof fetch):Promise<{status:AddressStatus;candidates:AddressInput[];unitChecked:false}>;
export function checkWeatherAddress(raw:unknown,transport?:typeof fetch):Promise<{status:AddressStatus;candidates:(AddressInput&{coordinates:{lat:number;lng:number}})[];unitChecked:false}>;
