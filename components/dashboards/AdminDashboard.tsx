
import React, { useEffect, useState } from 'react';
import { Profile, School, UserRole } from '../../types.ts';
import DashboardLayout from '../layout/DashboardLayout.tsx';
import { NavItem } from '../../lib/navigation.ts';
import { LayoutDashboard, School as SchoolIcon, Users, Settings, Plus, ShieldCheck, Search, ArrowLeft, CreditCard, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { schoolService } from '../../modules/school/school.service.ts';
import { profileService } from '../../modules/core/profile.service.ts';
import { SchoolSettingsComponent } from '../pages/SettingsPage.tsx';
import { PromoManagement } from '../pages/admin/PromoManagement.tsx';
import { PlatformSettingsComponent } from '../pages/admin/PlatformSettings.tsx';
import FeedbackPage from '../pages/FeedbackPage.tsx';

interface AdminDashboardProps {
  session: any;
  profile: Profile;
}

const adminNavItems: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Schools', icon: SchoolIcon },
  { label: 'Payment Gateway', icon: CreditCard },
  { label: 'Authorizations', icon: ShieldCheck },
  { label: 'Users', icon: Users },
  { label: 'Ad Management', icon: ImageIcon },
  { label: 'Feedback', icon: MessageSquare },
  { label: 'Platform Settings', icon: Settings },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ session, profile }) => {
  const [activePage, setActivePage] = useState('Overview');
  const [schools, setSchools] = useState<School[]>([]);
  const [pendingHeadteachers, setPendingHeadteachers] = useState<Profile[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [selectedSchools, setSelectedSchools] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolToManage, setSelectedSchoolToManage] = useState<School | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [schoolsRes, pendingHTRes, pendingTRes, profilesRes] = await Promise.all([
        schoolService.getAllSchools(),
        profileService.getPendingHeadteachers(),
        profileService.getPendingTeachers(),
        profileService.getAllProfiles()
      ]);

      if (schoolsRes.data) setSchools(schoolsRes.data);
      if (pendingHTRes.data) setPendingHeadteachers(pendingHTRes.data);
      if (pendingTRes.data) setPendingTeachers(pendingTRes.data);
      if (profilesRes.data) setAllProfiles(profilesRes.data);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    setIsActionLoading(true);
    try {
      const { data, error } = await schoolService.createSchool(newSchoolName);
      if (error) throw new Error(error);
      if (data) {
        setSchools([data, ...schools]);
        setNewSchoolName('');
        setShowAddSchool(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAuthorize = async (profileId: string) => {
    const schoolId = selectedSchools[profileId];
    if (!schoolId) {
      alert("Please select a school first");
      return;
    }

    const userToAuthorize = [...pendingHeadteachers, ...pendingTeachers].find(p => p.id === profileId);
    if (!userToAuthorize) return;

    setIsActionLoading(true);
    try {
      let error;
      if (userToAuthorize.role === 'Headteacher') {
        // Admins fully authorize Headteachers
        const res = await profileService.authorizeUser(profileId, schoolId);
        error = res.error;
      } else {
        // Admins only assign Teachers to a school; Headteachers will authorize them later
        const res = await profileService.assignUserToSchool(profileId, schoolId);
        error = res.error;
      }

      if (error) throw new Error(error);
      
      setPendingHeadteachers(pendingHeadteachers.filter(p => p.id !== profileId));
      setPendingTeachers(pendingTeachers.filter(p => p.id !== profileId));
      const newSelected = { ...selectedSchools };
      delete newSelected[profileId];
      setSelectedSchools(newSelected);
      
      if (userToAuthorize.role === 'Headteacher') {
        alert("Headteacher authorized successfully!");
      } else {
        alert("Teacher assigned to school successfully! The school's Headteacher must now authorize them.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to process authorization");
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (selectedSchoolToManage) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => setSelectedSchoolToManage(null)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-bold">{selectedSchoolToManage.name} Settings</h2>
              <p className="text-sm text-gray-500">Configure school details and payment gateway</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
            <SchoolSettingsComponent schoolId={selectedSchoolToManage.id} userRole={UserRole.Admin} />
          </div>
        </div>
      );
    }

    switch (activePage) {
      case 'Overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Schools</h3>
                <p className="text-3xl font-bold mt-2">{schools.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Pending Approvals</h3>
                <p className="text-3xl font-bold mt-2">{pendingHeadteachers.length + pendingTeachers.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Platform Status</h3>
                <div className="flex items-center mt-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <p className="text-lg font-bold">Healthy</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
              <h2 className="text-blue-800 dark:text-blue-300 font-bold text-lg">Platform Administration</h2>
              <p className="text-blue-600 dark:text-blue-400 mt-1">Welcome to the Superadmin dashboard. From here you can manage all school entities and platform-wide settings.</p>
              <div className="mt-4 flex gap-4">
                <button 
                  onClick={() => setActivePage('Payment Gateway')}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition-colors"
                >
                  Configure Payment Gateways
                </button>
              </div>
            </div>
          </div>
        );

      case 'Schools':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Registered Schools</h2>
              <button 
                onClick={() => setShowAddSchool(true)}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add School
              </button>
            </div>

            {showAddSchool && (
              <form onSubmit={handleCreateSchool} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-brand-100 dark:border-brand-900 shadow-lg animate-in fade-in slide-in-from-top-4">
                <h3 className="font-bold mb-4">Register New School</h3>
                <div className="flex gap-4">
                  <input 
                    required
                    value={newSchoolName}
                    onChange={e => setNewSchoolName(e.target.value)}
                    placeholder="School Legal Name"
                    className="flex-1 p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button 
                    disabled={isActionLoading}
                    className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    {isActionLoading ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddSchool(false)}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-bottom border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">School Name</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Created At</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {schools.map(school => (
                    <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{school.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full uppercase">
                          {school.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(school.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedSchoolToManage(school)}
                          className="text-brand-600 hover:underline text-sm font-medium"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {schools.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No schools registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Payment Gateway':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">School Payment Gateways</h2>
              <p className="text-sm text-gray-500">Configure Paystack keys for each school</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-bottom border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">School Name</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Public Key</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Secret Key</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {schools.map(school => (
                    <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{school.name}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-400">
                        {/* We would need to fetch settings for each school to show keys here, 
                            but for now we just provide a link to manage */}
                        Click Manage to view
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-400">
                        ••••••••••••
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedSchoolToManage(school)}
                          className="text-brand-600 hover:underline text-sm font-medium"
                        >
                          Configure Gateway
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Authorizations':
        const allPending = [...pendingHeadteachers, ...pendingTeachers];
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Pending User Authorizations</h2>
            
            <div className="grid grid-cols-1 gap-4">
              {allPending.map(user => (
                <div key={user.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-lg">{user.full_name}</h3>
                    <p className="text-gray-500 text-sm">Requested authorization as <span className="font-bold text-brand-600">{user.role}</span></p>
                    <p className="text-xs text-gray-400 mt-1">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                    <div className="w-full sm:w-64">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assign to School</label>
                      <select 
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        onChange={(e) => setSelectedSchools({ ...selectedSchools, [user.id]: e.target.value })}
                        value={selectedSchools[user.id] || ''}
                      >
                        <option value="">Select a school...</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={() => handleAuthorize(user.id)}
                      disabled={isActionLoading}
                      className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Authorize
                    </button>
                  </div>
                </div>
              ))}
              {allPending.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <ShieldCheck className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">No pending headteacher authorizations.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'Users':
        const filteredProfiles = allProfiles.filter(p => 
          p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.role.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Platform Users</h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search users or roles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-bottom border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">School</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredProfiles.map(p => {
                    const school = schools.find(s => s.id === p.school_id);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{p.full_name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                            p.role === 'Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            p.role === 'Headteacher' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {p.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {school ? school.name : <span className="text-gray-400 italic">Unassigned</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`w-2 h-2 rounded-full inline-block mr-2 ${p.is_onboarded ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                          <span className="text-sm">{p.is_onboarded ? 'Active' : 'Pending'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Ad Management':
        return <PromoManagement />;

      case 'Feedback':
        return <FeedbackPage session={session} profile={profile} />;

      case 'Platform Settings':
        return <PlatformSettingsComponent />;

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">Content for {activePage} is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      profile={profile}
      navItems={adminNavItems}
      activePage={activePage}
      setActivePage={setActivePage}
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default AdminDashboard;
