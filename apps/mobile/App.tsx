import {useEffect,useRef,useState} from 'react';
import {Alert,AppState,Image,Linking,Modal,Pressable,ScrollView,StyleSheet,Text,useColorScheme,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {useNetworkState} from 'expo-network';
import {StatusBar} from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import {WebView} from 'react-native-webview';
import {mobileNavigation,ownerStart,crmOrigin} from './src/navigation-policy';
import {appearanceScript,notificationDestination,parseNativeRequest} from './src/bridge-policy';
Notifications.setNotificationHandler({handleNotification:async(notification)=>({shouldPlaySound:Boolean(notification.request.content.sound),shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
type Mode='system'|'light'|'dark';
export default function App(){
 const web=useRef<WebView>(null),network=useNetworkState(),system=useColorScheme();
 const [active,setActive]=useState(AppState.currentState==='active'),[error,setError]=useState(''),[loading,setLoading]=useState(true),[mode,setMode]=useState<Mode>('system'),[preferences,setPreferences]=useState(false),[source,setSource]=useState(ownerStart);
 const currentUrl=useRef(ownerStart),pushPending=useRef(false);const dark=mode==='dark'||mode==='system'&&system==='dark',styles=makeStyles(dark);
 useEffect(()=>{const s=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>s.remove();},[]);
 useEffect(()=>{let live=true;void SecureStore.getItemAsync('ynsg.appearance.v1').then(value=>{if(live&&['system','light','dark'].includes(value||''))setMode(value as Mode);}).catch(()=>{});return()=>{live=false;};},[]);
 useEffect(()=>{web.current?.injectJavaScript(appearanceScript(mode,dark));},[mode,dark]);
 useEffect(()=>{
  const open=(data:unknown)=>{const url=notificationDestination(data);Notifications.clearLastNotificationResponse();if(!url)return;Alert.alert('Open saved CRM record?','Unsaved text on this screen may be lost. The notification does not approve or change the record.',[{text:'Keep this screen',style:'cancel'},{text:'Open record',onPress:()=>setSource(url)}]);};
  const subscription=Notifications.addNotificationResponseReceivedListener(value=>open(value.notification.request.content.data?.ynsg));
  const last=Notifications.getLastNotificationResponse();if(last)open(last.notification.request.content.data?.ynsg);
  return()=>subscription.remove();
 },[]);
 const offline=network.isConnected===false||network.isInternetReachable===false;
 const refresh=()=>Alert.alert('Refresh saved records?','Unsaved text may be lost. If a save result is uncertain, check its saved result in the CRM before refreshing.',[{text:'Keep this screen',style:'cancel'},{text:'Refresh',onPress:()=>{setError('');web.current?.reload();}}]);
 async function changeMode(value:Mode){setMode(value);try{await SecureStore.setItemAsync('ynsg.appearance.v1',value);}catch{setError('Appearance changed for this session. This device could not save the preference.');}}
 function reply(value:Record<string,unknown>){try{if(new URL(currentUrl.current).origin!==crmOrigin||new URL(currentUrl.current).pathname!=='/owner')return;}catch{return;}web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('ynsg-native-reply',{detail:${JSON.stringify(value)}}));true;`);}
 async function register(nonce:string,environment:'sandbox'|'production',scope:string){
  if(pushPending.current)return;pushPending.current=true;
  const fail=(code:string)=>reply({type:'ynsg.push.reply',nonce,error:code});
  try{
   if(!Device.isDevice||process.env.EXPO_PUBLIC_APNS_ENVIRONMENT!==environment){fail('device_setup_required');return;}
   let permission=await Notifications.getPermissionsAsync();if(!permission.granted&&permission.canAskAgain)permission=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:false,allowSound:true}});
   if(!permission.granted){fail('permission_denied');return;}
   const token=await Notifications.getDevicePushTokenAsync();if(token.type!=='ios'||typeof token.data!=='string'){fail('device_setup_required');return;}
   const deviceKey='ynsg.device.v1.'+scope;let device=await SecureStore.getItemAsync(deviceKey);if(!device){device=nonce;await SecureStore.setItemAsync(deviceKey,device);}
   reply({type:'ynsg.push.reply',nonce,device,token:token.data,environment});
  }catch{fail('device_connection_failed');}finally{pushPending.current=false;}
 }
 return <SafeAreaProvider><SafeAreaView style={styles.page}><StatusBar style={dark?'light':'dark'}/><View style={styles.header}><Image source={require('./assets/ynsg-logo.jpg')} style={styles.logo} accessibilityLabel="Your Neighborhood Service Guy"/><View style={styles.title}><Text style={styles.heading}>Owner workspace</Text><Text style={styles.subtitle}>Requests · work · invoices</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Appearance and phone settings" onPress={()=>setPreferences(true)} style={styles.iconButton}><Text style={styles.buttonText}>Settings</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Refresh saved CRM records" onPress={refresh} style={styles.button}><Text style={styles.buttonText}>Refresh</Text></Pressable></View>
 {loading&&<Text accessibilityLiveRegion="polite" style={styles.notice}>Opening your saved workspace…</Text>}
 <View style={styles.content}><WebView ref={web} source={{uri:source}} style={styles.web} originWhitelist={['*']} sharedCookiesEnabled thirdPartyCookiesEnabled={false} cacheEnabled={false} incognito={false} javaScriptCanOpenWindowsAutomatically={false} allowsBackForwardNavigationGestures allowsInlineMediaPlayback={false} injectedJavaScriptBeforeContentLoaded={appearanceScript(mode,dark)} onNavigationStateChange={state=>{currentUrl.current=state.url;}} onMessage={event=>{
  const value=parseNativeRequest(event.nativeEvent.data,event.nativeEvent.url);if(!value)return;
  if(value.type==='ynsg.theme.changed'){void changeMode(value.theme);return;}
  Alert.alert('Allow phone alerts?','New-request and upcoming-appointment alerts are optional. Lock-screen text stays generic. Review your saved alert choices in the CRM.',[{text:'Not now',style:'cancel',onPress:()=>reply({type:'ynsg.push.reply',nonce:value.nonce,error:'permission_denied'})},{text:'Continue',onPress:()=>void register(value.nonce,value.environment,value.scope)}]);
 }} onLoadEnd={()=>{setLoading(false);web.current?.injectJavaScript(appearanceScript(mode,dark));}} onError={()=>{setLoading(false);setError('The workspace could not load. Reconnect and check the saved record before retrying a change.');}} onHttpError={()=>setError('The workspace needs attention. Open it in your browser to review the saved record.')} onShouldStartLoadWithRequest={request=>{
  const route=mobileNavigation(request.url);if(route==='internal')return true;
  if(route==='external'&&request.navigationType==='click'&&request.isTopFrame!==false){void Linking.openURL(request.url).catch(()=>setError('That link could not open. Use the browser workspace.'));}
  else if(request.isTopFrame!==false)setError('Open the browser workspace to manage account connections or download an invoice.');return false;
 }} onOpenWindow={()=>setError('Open this link from the browser workspace; pop-up navigation is not enabled.')} onFileDownload={()=>setError('Open the browser workspace to download or share this invoice.')} />
 {!active&&<View style={styles.privacy} accessibilityLabel="Workspace hidden while inactive"><Text style={styles.heading}>Your Neighborhood Service Guy</Text></View>}
 {offline&&<View style={styles.offline}><Text style={styles.heading}>Connection unavailable</Text><Text style={styles.body}>Reconnect, then check saved results before retrying a booking, invoice or payment. This app does not queue offline changes.</Text></View>}
 </View>{error&&<View style={styles.error}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>void Linking.openURL(ownerStart)}><Text style={styles.buttonText}>Open browser workspace</Text></Pressable></View>}
 <Modal visible={preferences} animationType="none" transparent onRequestClose={()=>setPreferences(false)}><View style={styles.modal}><ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} accessibilityViewIsModal><Text style={styles.heading}>Make it comfortable</Text><Text style={styles.body}>Follow your device’s appearance or choose your own. Text follows your device’s accessibility size.</Text><View style={styles.modes}>{(['system','light','dark'] as Mode[]).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:mode===value}} style={[styles.choice,mode===value&&styles.selected]} onPress={()=>void changeMode(value)}><Text style={styles.choiceText}>{value==='system'?'Automatic':value==='light'?'Light':'Dark'}</Text></Pressable>)}</View><Text style={styles.body}>Phone alerts are optional. Connect this device in CRM Settings → Phone alerts, then choose requests, appointment reminders and quiet hours.</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>void Linking.openSettings()}><Text style={styles.buttonText}>Open device settings</Text></Pressable><Pressable accessibilityRole="button" style={styles.button} onPress={()=>void Linking.openURL(crmOrigin+'/privacy')}><Text style={styles.buttonText}>Privacy policy</Text></Pressable><Pressable accessibilityRole="button" style={styles.button} onPress={()=>setPreferences(false)}><Text style={styles.buttonText}>Done</Text></Pressable></ScrollView></View></Modal>
 </SafeAreaView></SafeAreaProvider>;
}
function makeStyles(dark:boolean){const bg=dark?'#101b24':'#f8f6ef',surface=dark?'#1b2a35':'#fff',text=dark?'#e8f0f4':'#10283c',muted=dark?'#b8ccd5':'#48616b',border=dark?'#385363':'#c9d4cf';return StyleSheet.create({page:{flex:1,backgroundColor:bg},header:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10,padding:12,borderBottomWidth:1,borderBottomColor:border},logo:{width:48,height:40,resizeMode:'contain',borderRadius:8},title:{flex:1,minWidth:100},heading:{fontSize:20,fontWeight:'700',color:text},subtitle:{fontSize:15,color:muted,marginTop:3},button:{minHeight:48,minWidth:64,justifyContent:'center',alignItems:'center',padding:12,borderRadius:12,backgroundColor:dark?'#3c6650':'#315842'},iconButton:{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'center',padding:10,borderRadius:12,backgroundColor:dark?'#3c6650':'#315842'},buttonText:{fontSize:16,fontWeight:'700',color:'#fff'},content:{flex:1},web:{flex:1,backgroundColor:surface},notice:{padding:12,fontSize:16,color:text},body:{fontSize:17,lineHeight:25,color:muted},error:{padding:14,gap:12,borderTopWidth:1,borderTopColor:border},privacy:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:bg,alignItems:'center',justifyContent:'center'},offline:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:bg,justifyContent:'center',padding:24,gap:14},modal:{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20},sheet:{backgroundColor:surface,borderRadius:24,borderWidth:1,borderColor:border,maxHeight:'90%',maxWidth:560,alignSelf:'center',width:'100%'},sheetContent:{padding:24,gap:18},modes:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{flexGrow:1,minHeight:48,padding:14,borderWidth:1,borderColor:border,borderRadius:12,alignItems:'center'},selected:{borderColor:dark?'#edbd6b':'#315842',borderWidth:2},choiceText:{fontSize:17,fontWeight:'600',color:text}});}
