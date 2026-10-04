export function mailActivationBlocker(delivery:{configurationVersion:number|null;senderMatches:boolean|null;testKey:string|null}|null,gmailTest:string,received:boolean):string|null{
 if(!delivery)return 'Email approval status could not be loaded. Press Refresh status.';
 if(!delivery.configurationVersion)return 'Publish your Company settings first so we can check the business sender.';
 if(!delivery.senderMatches)return 'The Gmail sender in Company settings must match your connected Google account. Update and publish the settings, then refresh status.';
 if(gmailTest!=='accepted'||!delivery.testKey)return 'Send a Gmail test to yourself before enabling notifications.';
 if(!received)return 'Confirm that you received the Gmail test by checking the box above.';
 return null;
}
