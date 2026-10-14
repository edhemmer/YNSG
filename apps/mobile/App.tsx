import {useEffect,useRef,useState} from 'react';
import {Alert,AppState,Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {useNetworkState} from 'expo-network';
import {StatusBar} from 'expo-status-bar';
import {WebView} from 'react-native-webview';
import {mobileNavigation,ownerStart} from './src/navigation-policy';
export default function App(){
 const web=useRef<WebView>(null),network=useNetworkState();
 const [active,setActive]=useState(AppState.currentState==='active'),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const s=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>s.remove();},[]);
 const offline=network.isConnected===false||network.isInternetReachable===false;
 const refresh=()=>Alert.alert('Refresh saved records?','Unsaved text may be lost. If a save result is uncertain, check its saved result in the CRM before refreshing.',[{text:'Keep this screen',style:'cancel'},{text:'Refresh',onPress:()=>{setError('');web.current?.reload();}}]);
 return <SafeAreaProvider><SafeAreaView style={styles.page}><StatusBar style="dark"/><View style={styles.header}><Image source={require('./assets/ynsg-logo.jpg')} style={styles.logo} accessibilityLabel="Your Neighborhood Service Guy"/><View style={styles.title}><Text style={styles.heading}>Owner workspace</Text><Text style={styles.subtitle}>Requests · work · invoices</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh saved CRM records" onPress={refresh} style={styles.button}><Text style={styles.buttonText}>Refresh</Text></Pressable></View>
 {loading&&<Text accessibilityLiveRegion="polite" style={styles.notice}>Opening your saved workspace…</Text>}
 <View style={styles.content}><WebView ref={web} source={{uri:ownerStart}} style={styles.web} originWhitelist={['*']} sharedCookiesEnabled thirdPartyCookiesEnabled={false} cacheEnabled={false} incognito={false} javaScriptCanOpenWindowsAutomatically={false} allowsBackForwardNavigationGestures allowsInlineMediaPlayback={false} onLoadEnd={()=>setLoading(false)} onError={()=>{setLoading(false);setError('The workspace could not load. Reconnect and review the saved record before retrying a change.');}} onHttpError={()=>setError('The workspace needs attention. Open it in your browser to review the saved record.')} onShouldStartLoadWithRequest={request=>{
  const route=mobileNavigation(request.url);
  if(route==='internal')return true;
  // External pages never receive CRM cookies. Only an explicit top-level link tap opens the system app.
  if(route==='external'&&request.navigationType==='click'&&request.isTopFrame!==false){void Linking.openURL(request.url).catch(()=>setError('That link could not open. Use the browser workspace.'));}
  else if(request.isTopFrame!==false)setError('Open the browser workspace to manage account connections or download an invoice.');
  return false;
 }} onOpenWindow={()=>setError('Open this link from the browser workspace; pop-up navigation is not enabled.')} onFileDownload={()=>setError('Open the browser workspace to download or share this invoice.')} />
 {!active&&<View style={styles.privacy} accessibilityLabel="Workspace hidden while inactive"><Text style={styles.heading}>Your Neighborhood Service Guy</Text></View>}
 {offline&&<View style={styles.offline}><Text style={styles.heading}>Connection unavailable</Text><Text style={styles.body}>Reconnect, then check saved results before retrying a booking, invoice or payment. This app does not queue offline changes.</Text></View>}
 </View>{error&&<View style={styles.error}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>void Linking.openURL(ownerStart)}><Text style={styles.buttonText}>Open browser workspace</Text></Pressable></View>}
 </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f8f6ef'},header:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderBottomWidth:1,borderBottomColor:'#c9d4cf'},logo:{width:58,height:44,resizeMode:'contain'},title:{flex:1},heading:{fontSize:20,fontWeight:'700',color:'#10283c'},subtitle:{fontSize:15,color:'#48616b',marginTop:3},button:{minHeight:48,minWidth:64,justifyContent:'center',alignItems:'center',paddingHorizontal:12,borderRadius:8,backgroundColor:'#315842'},buttonText:{fontSize:16,fontWeight:'700',color:'#fff'},content:{flex:1},web:{flex:1,backgroundColor:'#fff'},notice:{padding:12,fontSize:16,color:'#10283c'},body:{fontSize:17,lineHeight:25,color:'#283d45'},error:{padding:14,gap:12,borderTopWidth:1,borderTopColor:'#c9d4cf'},privacy:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#f8f6ef',alignItems:'center',justifyContent:'center'},offline:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#f8f6ef',justifyContent:'center',padding:24,gap:14}});
