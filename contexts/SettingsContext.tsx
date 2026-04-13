
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase.ts';
import { School, SchoolSettings, Profile } from '../types.ts';
import { Session } from '@supabase/supabase-js';

type Theme = 'light' | 'dark';

interface SettingsContextType {
  settings: SchoolSettings | null;
  school: School | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
  refetchSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: SchoolSettings = {
    id: '11111111-1111-1111-1111-111111111111',
    school_name: 'SmartSchool',
    logo_url: null,
    theme: 'light',
    motto: null,
    phone: null,
    email: null,
    address: null,
    school_latitude: null,
    school_longitude: null,
    paystack_public_key: null,
    paystack_secret_key: null,
    currency: 'GHS',
};


export const SettingsProvider: React.FC<{ children: ReactNode; session: Session | null; profile: Profile | null }> = ({ children, session, profile: profileProp }) => {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>(() => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  const lastUserId = React.useRef<string | null>(null);

  const fetchSettings = useCallback(async (force = false) => {
    if (!session?.user?.id) return;
    
    const userId = session.user.id;

    // If not forced and we already have settings for this user, don't show loading spinner
    if (!force && lastUserId.current === userId && settings) {
        // Just refresh in background
    } else {
        setIsLoading(true);
    }

    lastUserId.current = userId;
    let loadedSettings: SchoolSettings = { ...defaultSettings };
    let loadedSchool: School | null = null;

    try {
      // Use profile from props if available, otherwise fetch it
      let profile = profileProp;
      
      if (!profile || profile.id !== userId) {
        const { data: fetchedProfile, error: profileError } = await supabase
          .from('profiles')
          .select('school_id, role, admission_numbers')
          .eq('id', userId)
          .maybeSingle();
        
        if (!profileError && fetchedProfile) {
          profile = fetchedProfile as any;
        }
      }

      let effectiveSchoolId = profile?.school_id;

      // If Teacher or Headteacher has no school_id, try to find it from teachers table
      if (!effectiveSchoolId && (profile?.role === 'Teacher' || profile?.role === 'Headteacher')) {
        const { data: teacherRecord, error: teacherError } = await supabase
          .from('teachers')
          .select('school_id')
          .ilike('email', session.user.email || '')
          .limit(1)
          .maybeSingle();
          
        if (!teacherError && teacherRecord?.school_id) {
          effectiveSchoolId = teacherRecord.school_id;
          // Update the profile to save this school_id for future use
          await supabase.from('profiles').update({ school_id: effectiveSchoolId }).eq('id', userId);
        }
      }

      // If Parent has no school_id, try to find it from their wards
      const admissionNumbers = profile?.admission_numbers || [];
      if (!effectiveSchoolId && profile?.role === 'Parent' && admissionNumbers.length > 0) {
        const { data: wards, error: wardsError } = await supabase
          .from('students')
          .select('school_id')
          .in('admission_number', admissionNumbers)
          .limit(1);
        
        if (!wardsError && wards && wards.length > 0) {
          effectiveSchoolId = wards[0].school_id;
          // Update the profile to save this school_id for future use
          await supabase.from('profiles').update({ school_id: effectiveSchoolId }).eq('id', userId);
        }
      }

      // If Admin has no school_id, try to find the first school as a fallback
      if (!effectiveSchoolId && profile?.role === 'Admin') {
          const { data: firstSchool } = await supabase.from('schools').select('id').limit(1).maybeSingle();
          if (firstSchool) {
              effectiveSchoolId = firstSchool.id;
          }
      }

      if (effectiveSchoolId) {
        // Fetch both settings and school info
        const [settingsRes, schoolRes] = await Promise.all([
            supabase.from('school_settings').select('*').eq('id', effectiveSchoolId).maybeSingle(),
            supabase.from('schools').select('*').eq('id', effectiveSchoolId).maybeSingle()
        ]);

        if (settingsRes.data) {
          loadedSettings = { ...defaultSettings, ...settingsRes.data };
        }
        
        if (schoolRes.data) {
          loadedSchool = schoolRes.data;
        }
      }
    } catch (error: any) {
      console.error("Error fetching school settings:", error.message || error);
    } finally {
      setSettings(loadedSettings);
      setSchool(loadedSchool);
      setThemeState(loadedSettings.theme || 'light');
      setIsLoading(false);
    }
  }, [session?.user?.id]); // Only depend on the user ID string, not the whole session object

  useEffect(() => {
    if (session) {
      fetchSettings();
    } else {
      setSettings(defaultSettings);
      setSchool(null);
      setThemeState(defaultSettings.theme);
      setIsLoading(false);
    }
  }, [session?.user.id, profileProp?.school_id]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);


  return (
    <SettingsContext.Provider value={{ settings, school, isLoading, refetchSettings: fetchSettings, theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
