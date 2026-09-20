import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  TextInput, Alert, ActivityIndicator, Dimensions, StatusBar, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userService, UserProfileUpdate } from '../../services/userService';
import { authService } from '../../services/authService';
import { rawFoodService } from '../../services/rawFoodService';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown, FadeInUp, ZoomIn,
  useSharedValue, useAnimatedStyle, interpolate, Extrapolation, useAnimatedScrollHandler
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// --- CONSTANTS ---
const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Ít vận động' },
  { id: 'light', label: 'Nhẹ nhàng' },
  { id: 'moderate', label: 'Vừa phải' },
  { id: 'active', label: 'Năng động' },
  { id: 'very_active', label: 'Rất năng động' },
];

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#84CC16', '#EC4899',
];

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api');
const resolveImg = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

const getBMI = (height: number, weight: number) => {
  if (!height || !weight) return { value: '—', label: '—', color: '#94A3B8' };
  const h = height / 100;
  const bmi = parseFloat((weight / (h * h)).toFixed(1));
  if (bmi < 18.5) return { value: bmi, label: 'Thiếu cân', color: '#3B82F6' };
  if (bmi < 23) return { value: bmi, label: 'Bình thường', color: '#10B981' };
  if (bmi < 25) return { value: bmi, label: 'Thừa cân', color: '#F59E0B' };
  return { value: bmi, label: 'Béo phì', color: '#EF4444' };
};

// --- AMBIENT GLOW BACKGROUND ---
const AmbientGlowBackground = () => (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
    <Svg height="100%" width="100%">
      <Defs>
        <SvgRadialGradient id="p1" cx="80%" cy="0%" rx="70%" ry="60%">
          <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgRadialGradient id="p2" cx="0%" cy="30%" rx="55%" ry="55%">
          <Stop offset="0%" stopColor="#7C3AED" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgRadialGradient id="p3" cx="100%" cy="75%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.08" />
          <Stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#p1)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#p2)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#p3)" />
    </Svg>
  </View>
);

// --- STAT ITEM ---
const StatItem = ({ label, value, sub, color, icon }: any) => (
  <View className="items-center flex-1">
    <Animated.View entering={ZoomIn.delay(300).springify()} className="w-12 h-12 rounded-[20px] items-center justify-center mb-3" style={{ backgroundColor: `${color}18` }}>
      <Feather name={icon} size={20} color={color} />
    </Animated.View>
    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[2px] mb-1">{label}</Text>
    <Text className="text-slate-800 text-[20px] font-black tracking-tighter">{value}</Text>
    {sub && <Text className="text-slate-400 text-[10px] font-bold mt-0.5">{sub}</Text>}
  </View>
);

// --- MENU ROW ---
const MenuRow = ({ icon, label, value, onPress, isDestructive, color }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center px-5 py-4">
    <View
      className="w-11 h-11 rounded-[16px] items-center justify-center mr-4"
      style={{ backgroundColor: isDestructive ? '#FEF2F2' : `${color || '#8B5CF6'}15` }}
    >
      <Feather name={icon} size={19} color={isDestructive ? '#EF4444' : (color || '#8B5CF6')} />
    </View>
    <Text className={`flex-1 font-black text-[16px] tracking-tight ${isDestructive ? 'text-red-500' : 'text-slate-800'}`}>{label}</Text>
    {value && <Text className="text-slate-400 font-bold text-xs mr-2">{value}</Text>}
    {!isDestructive && <Feather name="chevron-right" size={18} color="#CBD5E1" />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState<'info' | 'allergies' | 'password' | 'diet' | 'activity' | null>(null);
  const [formData, setFormData] = useState<UserProfileUpdate>({});
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [selectedActivity, setSelectedActivity] = useState('');

  // Allergy search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [dietPresets, setDietPresets] = useState<any[]>([]);

  // Animated scroll
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP)
  }));

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, dietData] = await Promise.all([userService.getProfile(), userService.getDietPresets()]);
      setProfile(profileData);
      setDietPresets(dietData);
    } catch (error) { Alert.alert('Lỗi', 'Không thể tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userInfo');
          router.replace('/auth/sign-in');
        }
      }
    ]);
  };

  const handleResetTutorials = async () => {
    Alert.alert('Xem lại Hướng dẫn', 'Bạn có muốn xem lại toàn bộ Hướng dẫn của ứng dụng không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý', onPress: async () => {
          try {
            setLoading(true);
            await authService.resetAllEpicTutorials(); // Xoá cờ Local mọi trang Epic
            await userService.updateProfile({ has_seen_tutorial: false }); // Bật lại Cờ trên BackEnd (Chưa xem Tutorial gốc)
            Alert.alert('Thành công', 'Đang điều hướng về Trang Chủ...');
            setTimeout(() => {
              router.replace('/');
            }, 1000);
          } catch (e) {
            Alert.alert('Lỗi', 'Không thể khôi phục thao tác Hướng dẫn');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const updateDietMode = async (dietCode: string) => {
    try { await userService.updateProfile({ diet_preset_code: dietCode }); await loadData(); }
    catch (e) { Alert.alert('Lỗi', 'Không thể đổi chế độ ăn'); }
  };

  const updateActivityLevel = async (level: string) => {
    try { await userService.updateProfile({ activity_level: level }); await loadData(); setModalVisible(false); }
    catch (e) { Alert.alert('Lỗi', 'Không thể cập nhật mức vận động'); }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin'); return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp'); return;
    }
    await handleSave(async () => {
      await userService.changePassword(pwForm.current, pwForm.newPw);
      setPwForm({ current: '', newPw: '', confirm: '' });
    });
  };

  const handleSave = async (action: () => Promise<void>) => {
    try { setSaving(true); await action(); setModalVisible(false); await loadData(); Alert.alert('Thành công', 'Đã cập nhật'); }
    catch (e) { Alert.alert('Lỗi', 'Cập nhật thất bại'); } finally { setSaving(false); }
  };

  useEffect(() => {
    if (editMode !== 'allergies' || searchQuery.length <= 1) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try { const res = await rawFoodService.search(searchQuery); setSearchResults(res.data || []); }
      catch (e) { } finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, editMode]);

  const handleAvatarEdit = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const data = new FormData();
      // @ts-ignore
      data.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' });
      setLoading(true);
      try { await userService.uploadAvatar(data); await loadData(); }
      catch (e) { Alert.alert('Lỗi Upload'); } finally { setLoading(false); }
    }
  };

  if (loading && !profile) return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
  if (!profile) return null;

  const p = profile.UserProfile || {};
  const n = profile.UserNutritionTarget || {};
  const bmi = getBMI(p.height, p.current_weight);
  const activityLabel = ACTIVITY_LEVELS.find(a => a.id === p.activity_level)?.label || '—';

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <AmbientGlowBackground />

      {/* Static Header (Foods style) */}
      <BlurView
        tint="light" intensity={90}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + 16, paddingBottom: 16 }}
      >
        <View className="flex-row justify-between items-center px-5">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full bg-white/10 items-center justify-center border border-white/60 shadow-sm shadow-slate-200"
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <Text className="text-[22px] font-black text-slate-800 tracking-tight">Tài khoản</Text>

          <View className="w-11" />
        </View>
      </BlurView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 90, paddingBottom: 140 }}
      >
        {/* ── HERO SECTION ── */}
        <Animated.View entering={FadeInUp.delay(50).springify()} className="items-center px-6 mb-10 mt-4">
          {/* Avatar */}
          <View className="relative mb-6">
            <Animated.View
              entering={ZoomIn.delay(200).duration(600)}
              className="rounded-full border-[5px] border-white shadow-2xl shadow-violet-300"
              style={{ width: 150, height: 150, elevation: 20, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 24 }}
            >
              <Image
                source={{ uri: resolveImg(profile.avatar) ?? `https://ui-avatars.com/api/?background=8B5CF6&color=fff&name=${encodeURIComponent(profile.full_name || 'U')}` }}
                style={{ width: '100%', height: '100%', borderRadius: 999 }}
              />
            </Animated.View>
            <TouchableOpacity
              onPress={handleAvatarEdit}
              className="absolute bottom-1 right-1 w-11 h-11 rounded-full border-[4px] border-white items-center justify-center shadow-lg shadow-violet-500/40"
              style={{ backgroundColor: '#8B5CF6' }}
            >
              <Feather name="camera" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <Text className="text-[28px] font-[900] text-slate-800 tracking-tighter mb-2">{profile.full_name}</Text>
          <View className="bg-violet-50 px-5 py-2 rounded-full border border-violet-100">
            <Text className="text-violet-500 font-black text-[11px] uppercase tracking-[2px]">{profile.email}</Text>
          </View>
        </Animated.View>

        {/* ── STATS CARD ── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} className="px-5 mb-10">
          <View
            className="bg-white/80 rounded-[36px] p-7 border border-white/60 flex-row justify-between items-center"
            style={{ shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24 }}
          >
            <StatItem label="BMI" value={bmi.value} sub={bmi.label} color={bmi.color} icon="activity" />
            <View style={{ width: 1, height: 50, backgroundColor: '#E2E8F0' }} />
            <StatItem label="TDEE" value={n.tdee || '—'} sub="kcal/ngày" color="#F97316" icon="zap" />
            <View style={{ width: 1, height: 50, backgroundColor: '#E2E8F0' }} />
            <StatItem label="Cân nặng" value={p.current_weight ? `${p.current_weight}kg` : '—'} sub={p.goal_weight ? `Mục tiêu: ${p.goal_weight}kg` : ''} color="#10B981" icon="target" />
          </View>
        </Animated.View>


        {/* ── MENU SETTINGS ── */}
        <Animated.View entering={FadeInDown.delay(350).springify()} className="px-5 mb-10">
          <View className="flex-row items-center gap-3 mb-6">
            <Text className="text-[22px] font-[900] text-slate-800 tracking-tighter">Cài đặt</Text>
            <View className="h-[1px] flex-1 bg-slate-100" />
          </View>

          <View
            className="bg-white/75 rounded-[36px] border border-white/60 overflow-hidden"
            style={{ shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20 }}
          >
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="user" label="Thông tin cá nhân" color="#8B5CF6"
              onPress={() => {
                const pp = profile.UserProfile || {};
                setFormData({ full_name: profile.full_name, dob: pp.dob, height: pp.height, current_weight: pp.current_weight, goal_weight: pp.goal_weight, gender: pp.gender });
                setEditMode('info'); setModalVisible(true);
              }}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="wind" label="Chế độ dinh dưỡng"
              value={profile?.UserNutritionTarget?.DietPreset?.name || ''}
              color="#10B981"
              onPress={() => { setEditMode('diet'); setModalVisible(true); }}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="activity" label="Mức độ vận động" value={activityLabel} color="#3B82F6"
              onPress={() => { setSelectedActivity(p.activity_level || ''); setEditMode('activity'); setModalVisible(true); }}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="alert-circle" label="Dị ứng & Kiêng kỵ"
              value={p.allergies?.length ? `${p.allergies.length} món` : ''}
              color="#F59E0B"
              onPress={() => { setEditMode('allergies'); setSelectedAllergies(p.allergies || []); setModalVisible(true); }}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="lock" label="Đổi mật khẩu" color="#EF4444"
              onPress={() => { setPwForm({ current: '', newPw: '', confirm: '' }); setEditMode('password'); setModalVisible(true); }}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow
              icon="mail" label="Hỗ trợ & Góp ý" color="#0EA5E9"
              onPress={() => {
                const email = 'tunguykim@gmail.com';
                const subject = `Góp ý ứng dụng Healio Wellness - ${profile?.full_name || 'Người dùng'}`;
                Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`);
              }}
            />
            <MenuRow
              icon="help-circle" label="Xem lại Hướng dẫn App" color="#10B981"
              onPress={handleResetTutorials}
            />
            <View className="h-[1px] bg-slate-100/80 mx-5" />
            <MenuRow icon="log-out" label="Đăng xuất" isDestructive onPress={handleLogout} />
          </View>
        </Animated.View>

        <Text className="text-center text-slate-300 font-black text-[11px] tracking-[4px] uppercase mb-2">
          Healio Wellness • v1.0.0
        </Text>
        <Text className="text-center text-slate-500 text-xs px-6 mb-6">
          Phát triển bởi Tùng Uy và Hoàng Việt
        </Text>
      </Animated.ScrollView>

      {/* ── EDIT MODAL ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <View className="px-6 py-5 border-b border-slate-100 flex-row justify-between items-center">
            <Text className="font-[900] text-[22px] text-slate-800 tracking-tighter">
              {editMode === 'info' ? 'Thông tin cá nhân'
                : editMode === 'allergies' ? 'Dị ứng & Kiêng kỵ'
                  : editMode === 'password' ? 'Đổi mật khẩu'
                    : editMode === 'diet' ? 'Chế độ dinh dưỡng'
                      : 'Mức độ vận động'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-slate-100 w-11 h-11 rounded-full items-center justify-center">
              <Feather name="x" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Info Edit */}
          {editMode === 'info' && (
            <ScrollView className="p-6">
              <View className="bg-slate-50/80 p-6 rounded-[32px] mb-5 border border-slate-100">
                <Text className="text-[11px] text-slate-400 mb-2 font-black uppercase tracking-widest">Họ và tên</Text>
                <TextInput
                  value={formData.full_name}
                  onChangeText={t => setFormData({ ...formData, full_name: t })}
                  className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                />
                <View className="flex-row gap-5 mt-5">
                  <View className="flex-1">
                    <Text className="text-[11px] text-slate-400 mb-2 font-black uppercase tracking-widest">Chiều cao (cm)</Text>
                    <TextInput
                      value={formData.height?.toString()}
                      keyboardType="numeric"
                      onChangeText={t => setFormData({ ...formData, height: parseFloat(t) || 0 })}
                      className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] text-slate-400 mb-2 font-black uppercase tracking-widest">Ngày sinh</Text>
                    <TextInput
                      value={formData.dob}
                      placeholder="YYYY-MM-DD"
                      onChangeText={t => setFormData({ ...formData, dob: t })}
                      className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                    />
                  </View>
                </View>
              </View>

              <View className="bg-slate-50/80 p-6 rounded-[32px] mb-8 border border-slate-100">
                <Text className="text-[11px] text-slate-400 mb-2 font-black uppercase tracking-widest">Cân nặng (kg)</Text>
                <View className="flex-row gap-5">
                  <View className="flex-1">
                    <Text className="text-[12px] text-slate-500 mt-1.5 font-black tracking-tighter uppercase">Thực tế</Text>
                    <TextInput
                      value={formData.current_weight?.toString()}
                      keyboardType="numeric"
                      onChangeText={t => setFormData({ ...formData, current_weight: parseFloat(t) || 0 })}
                      className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[12px] text-slate-500 mt-1.5 font-black tracking-tighter uppercase">Mục tiêu</Text>
                    <TextInput
                      value={formData.goal_weight?.toString()}
                      keyboardType="numeric"
                      onChangeText={t => setFormData({ ...formData, goal_weight: parseFloat(t) || 0 })}
                      className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleSave(async () => await userService.updateProfile(formData))}
                className="py-5 rounded-[28px] items-center"
                style={{ backgroundColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20 }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-[900] text-[18px] tracking-tight">Cập nhật hồ sơ</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Allergies Edit */}
          {editMode === 'allergies' && (
            <View className="flex-1">
              <View className="px-6 py-4 z-20">
                <View className="bg-slate-50 border border-slate-200 p-4 rounded-[22px] flex-row items-center">
                  <Feather name="search" size={20} color="#8B5CF6" style={{ marginRight: 10 }} />
                  <TextInput
                    className="flex-1 text-[17px] font-black tracking-tight text-slate-800"
                    placeholder="Tìm kiếm thực phẩm dị ứng..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                {searchResults.length > 0 && (
                  <Animated.View
                    entering={FadeInDown}
                    className="absolute top-[85px] left-6 right-6 bg-white rounded-[28px] shadow-2xl border border-slate-100 z-50 max-h-72 overflow-hidden"
                    style={{ elevation: 30 }}
                  >
                    {searchResults.map((item: any) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => { setSelectedAllergies([...selectedAllergies, item.name]); setSearchQuery(''); setSearchResults([]); }}
                        className="p-4 border-b border-slate-50 flex-row items-center"
                      >
                        <View className="w-10 h-10 rounded-[14px] bg-violet-50 items-center justify-center mr-3">
                          <MaterialCommunityIcons name="food-apple-outline" size={20} color="#8B5CF6" />
                        </View>
                        <Text className="font-black text-[16px] text-slate-800 tracking-tight">{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </Animated.View>
                )}
              </View>

              <ScrollView className="flex-1 px-6 pt-2">
                <Text className="text-[11px] text-slate-400 font-black uppercase tracking-[2px] mb-5">
                  Danh sách dị ứng ({selectedAllergies.length})
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {selectedAllergies.map((a, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedAllergies(selectedAllergies.filter(x => x !== a))}
                      className="bg-white flex-row items-center px-4 py-2.5 rounded-[18px] border border-red-100 shadow-sm shadow-red-100"
                    >
                      <Text className="text-red-500 font-black text-[14px] mr-2 tracking-tight">{a}</Text>
                      <View className="bg-red-50 p-0.5 rounded-full">
                        <Feather name="x" size={13} color="#EF4444" />
                      </View>
                    </TouchableOpacity>
                  ))}
                  {selectedAllergies.length === 0 && (
                    <View className="items-center justify-center w-full py-16">
                      <MaterialCommunityIcons name="shield-check-outline" size={56} color="#E2E8F0" />
                      <Text className="text-slate-300 font-black tracking-tight mt-4 text-[16px]">Chưa có dữ liệu dị ứng</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View className="p-6 bg-white border-t border-slate-50">
                <TouchableOpacity
                  onPress={() => handleSave(async () => await userService.updateProfile({ allergies: selectedAllergies }))}
                  className="py-5 rounded-[28px] items-center"
                  style={{ backgroundColor: '#8B5CF6' }}
                >
                  <Text className="text-white font-[900] text-[18px] tracking-tight">Lưu danh sách</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Diet Edit */}
          {editMode === 'diet' && (
            <ScrollView className="p-6">
              <Text className="text-xs text-slate-400 font-black uppercase tracking-widest mb-5">Chọn chế độ phù hợp</Text>
              <View className="gap-y-3">
                {dietPresets.map((preset: any, index: number) => {
                  const color = PRESET_COLORS[index % PRESET_COLORS.length];
                  const isActive = profile?.UserNutritionTarget?.DietPreset?.code === preset.code;
                  return (
                    <TouchableOpacity
                      key={preset.code}
                      onPress={() => { updateDietMode(preset.code); setModalVisible(false); }}
                      activeOpacity={0.8}
                      className="flex-row items-center p-4 rounded-[24px] border"
                      style={{
                        backgroundColor: isActive ? `${color}10` : 'rgba(255,255,255,0.8)',
                        borderColor: isActive ? color : '#E2E8F0',
                      }}
                    >
                      <View className="w-12 h-12 rounded-[18px] items-center justify-center mr-4" style={{ backgroundColor: `${color}18` }}>
                        <MaterialCommunityIcons name={isActive ? 'star-circle' : 'leaf'} size={24} color={color} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-black text-[16px] tracking-tight" style={{ color: isActive ? color : '#1E293B' }}>{preset.name}</Text>
                        {preset.description && <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>{preset.description}</Text>}
                      </View>
                      {isActive && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Activity Level Edit */}
          {editMode === 'activity' && (
            <ScrollView className="p-6">
              <Text className="text-xs text-slate-400 font-black uppercase tracking-widest mb-5">Chọn mức vận động hàng ngày</Text>
              <View className="gap-y-3">
                {ACTIVITY_LEVELS.map((item) => {
                  const isSelected = selectedActivity === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setSelectedActivity(item.id)}
                      activeOpacity={0.8}
                      className="flex-row items-center p-4 rounded-[24px] border"
                      style={{
                        backgroundColor: isSelected ? '#3B82F610' : 'rgba(255,255,255,0.8)',
                        borderColor: isSelected ? '#3B82F6' : '#E2E8F0',
                      }}
                    >
                      <View className="w-12 h-12 rounded-[18px] items-center justify-center mr-4" style={{ backgroundColor: isSelected ? '#3B82F618' : '#F1F5F9' }}>
                        <Feather name="activity" size={20} color={isSelected ? '#3B82F6' : '#94A3B8'} />
                      </View>
                      <Text className="flex-1 font-black text-[16px] tracking-tight" style={{ color: isSelected ? '#3B82F6' : '#1E293B' }}>{item.label}</Text>
                      {isSelected && <View className="w-3 h-3 rounded-full bg-blue-500" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => updateActivityLevel(selectedActivity)}
                className="mt-6 py-5 rounded-[28px] items-center"
                style={{ backgroundColor: '#3B82F6' }}
              >
                <Text className="text-white font-[900] text-[18px] tracking-tight">Lưu mức vận động</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Password Edit */}
          {editMode === 'password' && (
            <ScrollView className="p-6">
              <View className="bg-slate-50/80 p-6 rounded-[32px] mb-8 border border-slate-100 gap-6">
                {[
                  { label: 'Mật khẩu hiện tại', key: 'current' as const },
                  { label: 'Mật khẩu mới', key: 'newPw' as const },
                  { label: 'Xác nhận mật khẩu mới', key: 'confirm' as const },
                ].map((item) => (
                  <View key={item.key}>
                    <Text className="text-[11px] text-slate-400 mb-2 font-black uppercase tracking-widest">{item.label}</Text>
                    <TextInput
                      secureTextEntry
                      value={pwForm[item.key]}
                      onChangeText={(t) => setPwForm({ ...pwForm, [item.key]: t })}
                      placeholder="• • • • • • • •"
                      className="py-2 text-[18px] border-b border-slate-200 text-slate-800 font-black tracking-tight"
                    />
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={handleChangePassword}
                className="py-5 rounded-[28px] items-center"
                style={{ backgroundColor: '#EF4444' }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-[900] text-[18px] tracking-tight">Đổi mật khẩu</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
