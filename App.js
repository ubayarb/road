import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  bg: '#0C1118',
  surface: '#151D28',
  surface2: '#1B2633',
  line: '#283747',
  text: '#F4F7FB',
  muted: '#99A9BA',
  orange: '#F5A33B',
  blue: '#56A9E8',
  green: '#57C98A',
  red: '#F06958',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://YOUR_UBUNTU_SERVER_IP:4000/api';

const REQUEST_TIMEOUT_MS = 15000;

async function apiRequest(path, payload, { method = 'POST', token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new Error('Сервертэй холбогдож чадсангүй. Интернэт болон серверийн хаягаа шалгана уу.');
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Сервертэй холбогдоход алдаа гарлаа.');
  return data;
}

const userTypes = [
  { id: 'driver', label: 'Жолооч' },
  { id: 'local', label: 'Орон нутгийн иргэн' },
  { id: 'miner', label: 'Уурхайн ажилтан' },
];
const userTypeLabel = (id) => userTypes.find((type) => type.id === id)?.label;

const tabs = [
  { id: 'home', icon: '⌂', label: 'Нүүр' },
  { id: 'route', icon: '⌁', label: 'Зам' },
  { id: 'orders', icon: '▣', label: 'Захиалга' },
  { id: 'community', icon: '◉', label: 'Community' },
  { id: 'profile', icon: '◯', label: 'Би' },
];

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Button({ title, onPress, kind = 'primary', style, disabled = false }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${kind}`], style, (pressed || disabled) && styles.pressed]}>
      <Text style={[styles.buttonText, kind === 'ghost' && styles.ghostText]}>{title}</Text>
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text>{action && <Pressable onPress={onAction}><Text style={styles.action}>{action}</Text></Pressable>}</View>;
}

function Home({ setTab, user }) {
  return <>
    <View style={styles.hero}>
      <View><Text style={styles.eyebrow}>ЦОГТЦЭЦИЙ · 18:40</Text><Text style={styles.greeting}>Замд гарахад{`\n`}бэлэн үү{user.name ? `, ${user.name}` : ''}?</Text></View>
      <View style={styles.weather}><Text style={styles.weatherIcon}>☀</Text><Text style={styles.weatherTemp}>-12°</Text><Text style={styles.weatherText}>Цэлмэг</Text></View>
    </View>
    {!user.profileComplete && <Pressable onPress={() => setTab('profile')}><Card style={styles.completeBanner}><View style={styles.flex}><Text style={styles.alertTitle}>Профайлаа гүйцээнэ үү</Text><Text style={styles.muted}>Овог, нэр, төрөл, нууц үгээ оруулснаар дараа нь утас + нууц үгээр нэвтэрнэ.</Text></View><Text style={styles.routeArrow}>›</Text></Card></Pressable>}
    <Card style={styles.alertCard}>
      <Text style={styles.alertIcon}>!</Text>
      <View style={styles.flex}><Text style={styles.alertTitle}>Гашуунсухайт чиглэл</Text><Text style={styles.muted}>Салхи ширүүсэх төлөвтэй. Хурдаа тохируулна уу.</Text></View>
    </Card>
    <SectionTitle title="Өнөөдрийн зам" />
    <Card>
      <View style={styles.rowBetween}><View><Text style={styles.routeLabel}>Таван толгой → Гашуунсухайт</Text><Text style={styles.muted}>239 км · ойролцоогоор 4 цаг 20 мин</Text></View><Text style={styles.routeArrow}>›</Text></View>
      <View style={styles.routeLine}><View style={[styles.routeDot, { backgroundColor: colors.green }]} /><View style={styles.routeDash} /><View style={[styles.routeDot, { backgroundColor: colors.orange }]} /></View>
      <View style={styles.statRow}><View><Text style={styles.statNumber}>1.5 цаг</Text><Text style={styles.statLabel}>Хил дээрх хүлээлт</Text></View><View><Text style={[styles.statNumber, { color: colors.green }]}>НЭЭЛТТЭЙ</Text><Text style={styles.statLabel}>Замын нөхцөл</Text></View></View>
      <Button title="Чиглэл эхлүүлэх" onPress={() => setTab('route')} style={styles.topGap} />
    </Card>
    <SectionTitle title="Шуурхай үйлдэл" />
    <View style={styles.quickGrid}>
      <Quick icon="⌖" label="Ойр үйлчилгээ" onPress={() => setTab('route')} />
      <Quick icon="▣" label="Урьдчилан захиалах" onPress={() => setTab('orders')} />
      <Quick icon="?" label="Зөвлөгөө" onPress={() => setTab('community')} />
      <Quick icon="✓" label="Аяллын checklist" onPress={() => Alert.alert('Checklist', 'Аяллын өмнөх жагсаалт нээгдлээ.')} />
    </View>
    <SectionTitle title="Шинэ мэдээлэл" action="Бүгд" />
    <Card><Text style={styles.newsTag}>АЛБАН МЭДЭЭ</Text><Text style={styles.newsTitle}>Цагаанхад боомтын нэвтрэх горим шинэчлэгдлээ</Text><Text style={styles.muted}>12 минутын өмнө · Унших ›</Text></Card>
  </>;
}

function Quick({ icon, label, onPress }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.quickText}>{label}</Text></Pressable>; }

function Route() {
  const stops = [['⛽', 'Цогтцэций ШТС', '12 км · Дизель 3,650₮', colors.orange], ['☕', 'Говь амралтын цэг', '78 км · 24 цаг нээлттэй', colors.green], ['⚑', 'Цагаанхад жин', '142 км · Хүлээлт 35 мин', colors.blue]];
  return <>
    <Text style={styles.pageTitle}>Миний зам</Text><Text style={styles.pageSubtitle}>Таван толгой → Гашуунсухайт</Text>
    <Card style={styles.mapCard}><View style={styles.mapRoad}><View style={styles.mapPin}><Text>●</Text></View><View style={styles.mapPath} /><View style={[styles.mapPin, { top: 124, left: '72%' }]}><Text>⚑</Text></View></View><Text style={styles.mapCaption}>239 км · 4 цаг 20 мин · Сүлжээгүй үед ч харах боломжтой</Text></Card>
    <SectionTitle title="Замын нөхцөл" />
    <View style={styles.conditionRow}><Card style={styles.condition}><Text style={[styles.conditionValue, { color: colors.green }]}>НЭЭЛТТЭЙ</Text><Text style={styles.statLabel}>Ерөнхий нөхцөл</Text></Card><Card style={styles.condition}><Text style={styles.conditionValue}>1.5 цаг</Text><Text style={styles.statLabel}>Хил дээрх хүлээлт</Text></Card></View>
    <SectionTitle title="Зам дагуух үйлчилгээ" action="Шүүлтүүр" />
    {stops.map(([icon, name, meta, accent]) => <Card key={name} style={styles.stop}><View style={[styles.stopIcon, { backgroundColor: `${accent}22` }]}><Text>{icon}</Text></View><View style={styles.flex}><Text style={styles.stopName}>{name}</Text><Text style={styles.muted}>{meta}</Text></View><Text style={styles.routeArrow}>›</Text></Card>)}
  </>;
}

function Orders() {
  const shops = [['Говь цайны газар', 'Хоол · 1.2 км', '20–30 мин'], ['Тавантолгой сэлбэг', 'Сэлбэг · 3.8 км', 'Бэлэн бараа'], ['Хурд засвар', 'Засвар · 5.1 км', 'Нээлттэй']];
  const [category, setCategory] = useState('Бүгд');
  const [selectedShop, setSelectedShop] = useState(null);
  const visibleShops = category === 'Бүгд' ? shops : shops.filter(([, type]) => type.startsWith(category));
  const confirmOrder = () => {
    setSelectedShop(null);
    Alert.alert('Захиалга хүлээн авлаа', `${selectedShop[0]} таны захиалгыг бэлтгэж эхэллээ. Бэлэн болмогц мэдэгдэнэ.`);
  };
  return <><Text style={styles.pageTitle}>Захиалга</Text><Text style={styles.pageSubtitle}>Замынхаа дагуу урьдчилан захиалаарай</Text><View style={styles.categoryRow}>{['Бүгд', 'Хоол', 'Сэлбэг', 'Засвар'].map(item => <Chip key={item} text={item} active={category === item} onPress={() => setCategory(item)} />)}</View><SectionTitle title="Таны ойролцоо" />{visibleShops.map((shop) => { const [name, type, time] = shop; return <Card key={name} style={styles.shop}><View style={styles.shopImage}><Text style={styles.shopEmoji}>{type.includes('Хоол') ? '☕' : type.includes('Сэлбэг') ? '⚙' : '🔧'}</Text></View><View style={styles.flex}><Text style={styles.stopName}>{name}</Text><Text style={styles.muted}>{type}</Text><Text style={styles.ready}>{time}</Text></View><Button title="Захиалах" kind="ghost" style={styles.smallButton} onPress={() => setSelectedShop(shop)} /></Card>; })}<Modal visible={Boolean(selectedShop)} transparent animationType="fade" onRequestClose={() => setSelectedShop(null)}><View style={styles.modalBack}><View style={styles.modal}><Text style={styles.modalTitle}>Захиалгаа баталгаажуулах</Text><Text style={styles.modalText}>{selectedShop && `${selectedShop[0]} · ${selectedShop[1]}\nБэлэн болох хугацаа: ${selectedShop[2]}`}</Text><Button title="Захиалга баталгаажуулах" onPress={confirmOrder} /><Button title="Буцах" kind="ghost" style={styles.topGap} onPress={() => setSelectedShop(null)} /></View></View></Modal></>;
}
function Chip({ text, active, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text></Pressable>; }

function Community() { return <><Text style={styles.pageTitle}>ROAD зөвлөгөө</Text><Text style={styles.pageSubtitle}>Жолооч нарын баталгаатай мэдлэгийн сан</Text><Card style={styles.tipHero}><Text style={styles.tipIcon}>🛞</Text><View style={styles.flex}><Text style={styles.tipTitle}>Дугуй хагарсан үед яах вэ?</Text><Text style={styles.muted}>Алхам алхмаар заавар · Offline</Text></View><Text style={styles.routeArrow}>›</Text></Card><SectionTitle title="Сүүлийн зөвлөгөө" />{[['Ачаа бэхэлгээг 5 минутанд шалгах нь', 'Бат · Verified жолооч'], ['Өвлийн дизель: юуг анхаарах вэ?', 'Эрдэнэ · 12 хэрэгтэй'], ['Хил рүү орохын өмнөх checklist', 'ROAD редакц']].map(([title, author]) => <Card key={title} style={styles.article}><Text style={styles.articleType}>ЗАМЫН ЗӨВЛӨГӨӨ</Text><Text style={styles.articleTitle}>{title}</Text><Text style={styles.muted}>{author}</Text></Card>)}</>;
}

function ProfileForm({ user, token, onSaved }) {
  const [lastName, setLastName] = useState(user.lastName || '');
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [userType, setUserType] = useState(user.userType || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (lastName.trim().length < 2) return Alert.alert('Овог оруулна уу', 'Хамгийн багадаа 2 үсэгтэй овог оруулна уу.');
    if (name.trim().length < 2) return Alert.alert('Нэр оруулна уу', 'Хамгийн багадаа 2 үсэгтэй нэр оруулна уу.');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Alert.alert('Имэйл буруу байна', 'Зөв имэйл хаяг оруулна уу, эсвэл хоосон үлдээнэ үү.');
    if (!userType) return Alert.alert('Төрлөө сонгоно уу', 'Та аль төрлийн хэрэглэгч болохоо сонгоно уу.');
    if (password.length < 6) return Alert.alert('Нууц үг богино байна', 'Хамгийн багадаа 6 тэмдэгт оруулна уу.');
    if (password !== confirmPassword) return Alert.alert('Нууц үг таарахгүй байна', 'Нууц үгээ хоёр талбарт ижил оруулна уу.');
    try {
      setLoading(true);
      const response = await apiRequest('/me/profile', { lastName, name, email, userType, password }, { method: 'PUT', token });
      onSaved(response.user);
      Alert.alert('Профайл хадгалагдлаа', 'Дараа нь утасны дугаар, нууц үгээрээ нэвтэрнэ.');
    } catch (error) {
      Alert.alert('Хадгалж чадсангүй', error.message);
    } finally {
      setLoading(false);
    }
  };
  return <Card style={styles.profileForm}>
    <Text style={styles.alertTitle}>Профайлаа гүйцээнэ үү</Text>
    <Text style={styles.muted}>Нууц үгээ тохируулснаар дараа нь утас + нууц үгээр нэвтэрнэ.</Text>
    <Text style={styles.inputLabel}>Овог</Text><TextInput value={lastName} onChangeText={setLastName} placeholder="Таны овог" placeholderTextColor={colors.muted} autoCapitalize="words" style={styles.input} />
    <Text style={styles.inputLabel}>Нэр</Text><TextInput value={name} onChangeText={setName} placeholder="Таны нэр" placeholderTextColor={colors.muted} autoCapitalize="words" style={styles.input} />
    <Text style={styles.inputLabel}>Имэйл хаяг <Text style={styles.optional}>(заавал биш)</Text></Text><TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={styles.input} />
    <Text style={styles.inputLabel}>Хэрэглэгчийн төрөл</Text><View style={styles.typeRow}>{userTypes.map((type) => <Chip key={type.id} text={type.label} active={userType === type.id} onPress={() => setUserType(type.id)} />)}</View>
    <Text style={styles.inputLabel}>Нууц үг</Text><TextInput value={password} onChangeText={setPassword} placeholder="Хамгийн багадаа 6 тэмдэгт" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
    <Text style={styles.inputLabel}>Нууц үгээ давтана уу</Text><TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Нууц үгээ дахин оруулна уу" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
    <Button title={loading ? 'Хадгалж байна...' : 'Хадгалах'} onPress={save} style={styles.authButton} disabled={loading} />
  </Card>;
}

function Profile({ onLogout, onProfileSaved, user, token }) { return <><Text style={styles.pageTitle}>Миний профайл</Text><Card style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(user.name || '?').charAt(0).toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.profileName}>{[user.lastName, user.name].filter(Boolean).join(' ') || 'Нэр оруулаагүй'}</Text><Text style={styles.muted}>{[user.phone, userTypeLabel(user.userType)].filter(Boolean).join(' · ')}</Text>{user.email && <Text style={styles.muted}>{user.email}</Text>}</View></Card>{!user.profileComplete && <ProfileForm user={user} token={token} onSaved={onProfileSaved} />}<SectionTitle title="Аяллын дэвтэр" /><View style={styles.conditionRow}><Card style={styles.condition}><Text style={styles.conditionValue}>12</Text><Text style={styles.statLabel}>Энэ сарын аялал</Text></Card><Card style={styles.condition}><Text style={styles.conditionValue}>4,820</Text><Text style={styles.statLabel}>Нийт км</Text></Card></View><SectionTitle title="Тохиргоо" />{['Миний захиалгууд', 'Мэдэгдэл', 'Оффлайн газрын зураг', 'Тусламж'].map(item => <Pressable key={item} onPress={() => Alert.alert(item, 'Энэ хэсэг удахгүй нээгдэнэ.')}><Card style={styles.settings}><Text style={styles.stopName}>{item}</Text><Text style={styles.routeArrow}>›</Text></Card></Pressable>)}<Button title="Гарах" kind="ghost" style={styles.topGap} onPress={onLogout} /></>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';
  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPassword('');
    setVerificationCode('');
    setCodeSent(false);
  };
  const sendCode = async () => {
    if (phone.replace(/\s/g, '').length < 8) {
      Alert.alert('Утасны дугаар', 'Зөв утасны дугаар оруулна уу.');
      return;
    }
    try {
      setLoading(true);
      await apiRequest('/auth/request-otp', { phone });
      setCodeSent(true);
      Alert.alert('Баталгаажуулах код илгээгдлээ', '6 оронтой кодоо оруулаад "Баталгаажуулах" дарна уу.');
    } catch (error) {
      Alert.alert('Код илгээж чадсангүй', error.message);
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    if (!isRegister && (phone.trim().length < 8 || password.length < 4)) {
      Alert.alert('Мэдээллээ шалгана уу', 'Утасны дугаар болон нууц үгээ оруулна уу.');
      return;
    }
    if (isRegister && !codeSent) return Alert.alert('Код илгээгээгүй байна', 'Эхлээд утасны дугаартаа баталгаажуулах код илгээнэ үү.');
    if (isRegister && !/^\d{6}$/.test(verificationCode)) return Alert.alert('Код буруу байна', '6 оронтой баталгаажуулах кодоо оруулна уу.');
    try {
      setLoading(true);
      const response = isRegister
        ? await apiRequest('/auth/verify-otp', { phone, code: verificationCode })
        : await apiRequest('/auth/login', { phone, password });
      onAuthenticated(response.user, response.token);
    } catch (error) {
      Alert.alert(isRegister ? 'Бүртгэл амжилтгүй' : 'Нэвтрэх боломжгүй', error.message);
    } finally {
      setLoading(false);
    }
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
    <View style={styles.authLogo}><View style={styles.logoMark}><Text style={styles.logoText}>R</Text></View><Text style={styles.logoName}>ROAD</Text><Text style={styles.logoTag}>Жолоочийн өдөр тутмын хамтрагч</Text></View>
    <Text style={styles.authTitle}>{isRegister ? 'Шинэ бүртгэл' : 'Тавтай морил'}</Text>
    <Text style={styles.authSubtitle}>{isRegister ? 'ROAD-д нэгдэж, замын мэдээллээ нэг дороос аваарай.' : 'Утасны дугаараа ашиглан нэвтэрнэ үү.'}</Text>
    <View style={styles.authTabs}><Pressable style={[styles.authTab, !isRegister && styles.authTabActive]} onPress={() => switchMode('login')}><Text style={[styles.authTabText, !isRegister && styles.authTabTextActive]}>Нэвтрэх</Text></Pressable><Pressable style={[styles.authTab, isRegister && styles.authTabActive]} onPress={() => switchMode('register')}><Text style={[styles.authTabText, isRegister && styles.authTabTextActive]}>Бүртгүүлэх</Text></Pressable></View>
    <Text style={styles.inputLabel}>Утасны дугаар</Text><TextInput value={phone} onChangeText={setPhone} placeholder="9911 2233" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
    {isRegister && <><Button title={loading ? 'Илгээж байна...' : codeSent ? 'Код дахин илгээх' : 'Баталгаажуулах код илгээх'} kind="ghost" style={styles.sendCodeButton} onPress={sendCode} disabled={loading} />{codeSent && <><Text style={styles.inputLabel}>Баталгаажуулах код</Text><TextInput value={verificationCode} onChangeText={setVerificationCode} placeholder="6 оронтой код" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} style={styles.input} /></>}</>}
    {!isRegister && <><Text style={styles.inputLabel}>Нууц үг</Text><TextInput value={password} onChangeText={setPassword} placeholder="Нууц үгээ оруулна уу" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} /></>}
    <Button title={loading ? 'Түр хүлээнэ үү...' : isRegister ? 'Баталгаажуулах' : 'Нэвтрэх'} onPress={submit} style={styles.authButton} disabled={loading || (isRegister && !codeSent)} />
    <Text style={styles.authHint}>{isRegister ? 'Код 5 минутын хугацаатай. Овог, нэр, нууц үгээ дараа нь профайл хэсэгт оруулна.' : 'Бүртгэлтэй утасны дугаар, нууц үгээ оруулна уу.'}</Text>
  </ScrollView></SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

function Main() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [sosOpen, setSosOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const onAuthenticated = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    setTab(nextUser.profileComplete ? 'home' : 'profile');
    setAuthenticated(true);
  };
  const logout = () => { setUser(null); setToken(null); setAuthenticated(false); };
  if (!authenticated) return <AuthScreen onAuthenticated={onAuthenticated} />;
  const screens = { home: <Home setTab={setTab} user={user} />, route: <Route />, orders: <Orders />, community: <Community />, profile: <Profile user={user} token={token} onProfileSaved={setUser} onLogout={logout} /> };
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><StatusBar style="light" /><ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>{screens[tab]}</ScrollView><Pressable style={[styles.sos, { bottom: 82 + insets.bottom }]} onPress={() => setSosOpen(true)}><Text style={styles.sosText}>SOS</Text></Pressable><View style={[styles.tabs, { height: 72 + insets.bottom, paddingBottom: insets.bottom }]}>{tabs.map(t => <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab}><Text style={[styles.tabIcon, tab === t.id && styles.tabActive]}>{t.icon}</Text><Text style={[styles.tabText, tab === t.id && styles.tabActive]}>{t.label}</Text></Pressable>)}</View><Modal visible={sosOpen} transparent animationType="slide" onRequestClose={() => setSosOpen(false)}><View style={styles.modalBack}><View style={styles.modal}><Text style={styles.modalTitle}>Яаралтай тусламж</Text><Text style={styles.modalText}>Таны байршил болон тээврийн мэдээллийг тусламжийн сүлжээнд илгээх үү?</Text><Button title="SOS илгээх" kind="danger" onPress={() => { setSosOpen(false); Alert.alert('SOS илгээгдлээ', 'Таны байршлыг хуваалцаж байна.'); }} /><Button title="Болих" kind="ghost" style={styles.topGap} onPress={() => setSosOpen(false)} /></View></View></Modal></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:112},authContent:{padding:24,paddingTop:72,flexGrow:1},authLogo:{alignItems:'center',marginBottom:48},logoMark:{width:58,height:58,borderRadius:18,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',marginBottom:12},logoText:{color:colors.bg,fontWeight:'900',fontSize:30},logoName:{color:colors.text,fontSize:25,fontWeight:'900',letterSpacing:2},logoTag:{color:colors.muted,fontSize:12,marginTop:6},authTitle:{color:colors.text,fontSize:28,fontWeight:'900'},authSubtitle:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:8,marginBottom:25},authTabs:{flexDirection:'row',backgroundColor:colors.surface,padding:4,borderRadius:12,marginBottom:25},authTab:{flex:1,alignItems:'center',paddingVertical:10,borderRadius:9},authTabActive:{backgroundColor:colors.surface2},authTabText:{color:colors.muted,fontWeight:'800',fontSize:13},authTabTextActive:{color:colors.text},inputLabel:{color:colors.text,fontWeight:'800',fontSize:12,marginBottom:7,marginTop:14},input:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:14,paddingVertical:13,color:colors.text,fontSize:15},sendCodeButton:{marginTop:10},authButton:{marginTop:24},authHint:{color:colors.muted,fontSize:11,lineHeight:17,textAlign:'center',marginTop:16,paddingHorizontal:12},flex:{flex:1},hero:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingTop:12,paddingBottom:22},eyebrow:{color:colors.orange,fontSize:11,fontWeight:'800',letterSpacing:1.2},greeting:{color:colors.text,fontSize:27,fontWeight:'800',lineHeight:34,marginTop:7},weather:{alignItems:'center'},weatherIcon:{fontSize:28,color:colors.orange},weatherTemp:{fontSize:18,fontWeight:'800',color:colors.text},weatherText:{fontSize:11,color:colors.muted},card:{backgroundColor:colors.surface,borderColor:colors.line,borderWidth:1,borderRadius:16,padding:15,marginBottom:12},alertCard:{flexDirection:'row',gap:10,borderColor:'#774735',backgroundColor:'#211B19'},alertIcon:{color:colors.orange,fontSize:18,fontWeight:'900',marginRight:10},alertTitle:{color:colors.text,fontWeight:'800',marginBottom:3},completeBanner:{flexDirection:'row',alignItems:'center',gap:10,borderColor:colors.orange},profileForm:{marginTop:2,borderColor:colors.orange},typeRow:{flexDirection:'row',flexWrap:'wrap',gap:7},optional:{color:colors.muted,fontWeight:'600'},muted:{color:colors.muted,fontSize:12,lineHeight:18},sectionTitle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12,marginBottom:9},sectionHeading:{color:colors.text,fontSize:17,fontWeight:'800'},action:{color:colors.blue,fontSize:13,fontWeight:'700'},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},routeLabel:{color:colors.text,fontSize:15,fontWeight:'800',marginBottom:3},routeArrow:{color:colors.muted,fontSize:28},routeLine:{flexDirection:'row',alignItems:'center',marginVertical:16},routeDot:{width:10,height:10,borderRadius:10},routeDash:{height:2,backgroundColor:colors.line,flex:1,marginHorizontal:6},statRow:{flexDirection:'row',gap:36},statNumber:{color:colors.text,fontWeight:'800',fontSize:16},statLabel:{color:colors.muted,fontSize:11,marginTop:3},topGap:{marginTop:12},button:{borderRadius:11,paddingVertical:12,alignItems:'center'},button_primary:{backgroundColor:colors.orange},button_danger:{backgroundColor:colors.red},button_ghost:{borderColor:colors.line,borderWidth:1,backgroundColor:colors.surface2},buttonText:{color:'#17120B',fontWeight:'900',fontSize:13},ghostText:{color:colors.text},pressed:{opacity:.72},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},quick:{width:'48%',backgroundColor:colors.surface,borderColor:colors.line,borderWidth:1,borderRadius:14,padding:13,minHeight:82},quickIcon:{color:colors.orange,fontSize:20,fontWeight:'800',marginBottom:7},quickText:{color:colors.text,fontSize:12,fontWeight:'700'},newsTag:{color:colors.orange,fontSize:10,fontWeight:'900',letterSpacing:1},newsTitle:{color:colors.text,fontSize:15,fontWeight:'800',lineHeight:21,marginVertical:7},pageTitle:{color:colors.text,fontSize:27,fontWeight:'800',paddingTop:12},pageSubtitle:{color:colors.muted,fontSize:13,marginTop:4,marginBottom:10},mapCard:{height:230,padding:0,overflow:'hidden'},mapRoad:{height:190,backgroundColor:'#142333',position:'relative',overflow:'hidden'},mapPath:{position:'absolute',width:270,height:270,borderColor:colors.orange,borderWidth:8,borderRadius:150,transform:[{rotate:'-38deg'}],top:-56,left:12,borderLeftColor:'transparent',borderBottomColor:'transparent'},mapPin:{position:'absolute',top:53,left:'20%',backgroundColor:colors.text,width:26,height:26,borderRadius:15,alignItems:'center',justifyContent:'center'},mapCaption:{color:colors.muted,fontSize:11,padding:10},conditionRow:{flexDirection:'row',gap:10},condition:{flex:1},conditionValue:{fontSize:16,fontWeight:'900',color:colors.text},stop:{flexDirection:'row',alignItems:'center',gap:10},stopIcon:{height:43,width:43,borderRadius:12,alignItems:'center',justifyContent:'center'},stopName:{color:colors.text,fontSize:14,fontWeight:'800',marginBottom:3},categoryRow:{flexDirection:'row',gap:7,marginVertical:12},chip:{paddingHorizontal:13,paddingVertical:7,borderRadius:20,borderColor:colors.line,borderWidth:1},chipActive:{backgroundColor:colors.orange,borderColor:colors.orange},chipText:{color:colors.muted,fontSize:12,fontWeight:'700'},chipTextActive:{color:'#17120B'},shop:{flexDirection:'row',alignItems:'center',gap:11},shopImage:{height:56,width:56,borderRadius:12,backgroundColor:'#283540',alignItems:'center',justifyContent:'center'},shopEmoji:{fontSize:26},ready:{color:colors.green,fontWeight:'800',fontSize:11,marginTop:5},smallButton:{paddingHorizontal:11,paddingVertical:9,marginLeft:2},tipHero:{flexDirection:'row',alignItems:'center',gap:12,borderColor:'#795933',backgroundColor:'#211B17'},tipIcon:{fontSize:29},tipTitle:{color:colors.text,fontSize:15,fontWeight:'800',marginBottom:4},article:{paddingVertical:14},articleType:{color:colors.blue,fontSize:10,fontWeight:'900',letterSpacing:.8},articleTitle:{color:colors.text,fontSize:15,fontWeight:'800',marginVertical:6},profileCard:{flexDirection:'row',alignItems:'center',gap:12,marginTop:14},avatar:{height:52,width:52,borderRadius:26,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:22,fontWeight:'900',color:'#17120B'},profileName:{color:colors.text,fontSize:17,fontWeight:'800',marginBottom:4},settings:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},sos:{position:'absolute',right:22,bottom:82,width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',backgroundColor:colors.red,boxShadow:`0 0 14px ${colors.red}99`},sosText:{color:'#fff',fontWeight:'900',fontSize:13},tabs:{height:72,position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#111923',borderTopWidth:1,borderTopColor:colors.line,flexDirection:'row',paddingTop:8},tab:{flex:1,alignItems:'center',gap:3},tabIcon:{color:colors.muted,fontSize:20,lineHeight:22},tabText:{color:colors.muted,fontSize:9,fontWeight:'700'},tabActive:{color:colors.orange},modalBack:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.6)'},modal:{backgroundColor:colors.surface2,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:36},modalTitle:{color:colors.text,fontSize:22,fontWeight:'900'},modalText:{color:colors.muted,lineHeight:21,marginTop:8,marginBottom:20}
});
