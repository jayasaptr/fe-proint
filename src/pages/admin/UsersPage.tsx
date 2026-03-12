import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assignRole, deleteUser, getCurrentUser, getRoles, getUsers, registerUser, removeRole, updateUser, type Role, type User } from '@/lib/api/users';
import { format } from 'date-fns';
import { AlertTriangle, Edit, Loader2, MoreHorizontal, PlusCircle, Search, Shield, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    password: '',
    roleId: ''
  });
  const [addError, setAddError] = useState('');

  // Edit User State
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: ''
  });
  const [editError, setEditError] = useState('');

  // Roles State
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [rolesError, setRolesError] = useState('');

  useEffect(() => {
    const initPage = async () => {
      try {
        const userRes = await getCurrentUser();
        const isAdmin = userRes.data?.roles?.includes('Admin');
        const isHR = userRes.data?.roles?.some((r: string) => r.toLowerCase() === 'hr');

        if (userRes.success && userRes.data && isAdmin && !isHR) {
          setIsAuthorized(true);
          fetchRolesList();
        } else {
          setIsAuthorized(false);
          setLoading(false);
        }
      } catch (error) {
        setIsAuthorized(false);
        setLoading(false);
      }
    };
    initPage();
  }, []);

  const fetchUsersList = async () => {
    try {
      setLoading(true);
      const params: { role?: string; name?: string; page?: number; per_page?: number } = { page, per_page: perPage };
      if (searchTerm) params.name = searchTerm;
      if (roleFilter !== 'all') params.role = roleFilter;

      const res = await getUsers(params);
      if (res.success && res.data) {
        setUsers(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages);
        }
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset page when search or role filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    if (isAuthorized) {
      const timer = setTimeout(() => {
        fetchUsersList();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [page, searchTerm, roleFilter, isAuthorized]);

  const fetchRolesList = async () => {
    try {
      const res = await getRoles();
      if (res.success && res.data) {
        setRoles(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch roles', error);
    }
  };

  useEffect(() => {
    if (roles.length > 0 && !addForm.roleId) {
      setAddForm(prev => ({ ...prev, roleId: roles[0].id }));
    }
  }, [roles]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name || !addForm.username || !addForm.password) {
      setAddError('Please fill in all required fields.');
      return;
    }

    try {
      setAddLoading(true);
      const role_ids = [addForm.roleId];

      const res = await registerUser({
        name: addForm.name,
        username: addForm.username,
        password: addForm.password,
        role_ids
      });

      if (res.success) {
        setIsAddUserOpen(false);
        setAddForm({ name: '', username: '', password: '', roleId: roles.length > 0 ? roles[0].id : '' });
        fetchUsersList(); // Refresh list
      } else {
        setAddError(res.message || 'Failed to register user');
      }
    } catch (error: any) {
       setAddError(error.response?.data?.message || 'An error occurred during registration');
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({ name: user.name, username: user.username, password: '' });
    setEditError('');
    setIsEditUserOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    try {
      setEditLoading(true);
      const res = await updateUser(editingUserId, {
        name: editForm.name,
        username: editForm.username,
        ...(editForm.password ? { password: editForm.password } : {})
      });

      if (res.success) {
        setIsEditUserOpen(false);
        fetchUsersList();
      } else {
        setEditError(res.message || 'Failed to update user');
      }
    } catch (error: any) {
       setEditError(error.response?.data?.message || 'An error occurred during update');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(id);
        fetchUsersList(); // Refresh the list
      } catch (err: any) {
        alert(err.response?.data?.message || err.message || 'Failed to delete user');
      }
    }
  };

  const openRolesModal = (user: User) => {
    setManagingUser(user);
    setRolesError('');
    setIsRolesOpen(true);
  };

  const handleToggleRole = async (roleName: string, roleId: string) => {
    if (!managingUser) return;
    setRolesError('');
    setRolesLoading(true);

    const hasRole = managingUser.roles.includes(roleName);

    try {
      let res;
      if (hasRole) {
        res = await removeRole(managingUser.id, roleId);
      } else {
        res = await assignRole(managingUser.id, roleId);
      }

      if (res.success && res.data) {
        setManagingUser(res.data);
        fetchUsersList(); // Update background list
      } else {
        setRolesError(res.message || 'Failed to toggle role');
      }
    } catch (error: any) {
      setRolesError(error.response?.data?.message || 'An error occurred modifying role');
    } finally {
      setRolesLoading(false);
    }
  };

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-in fade-in duration-500 text-center">
        <div className="bg-red-50 dark:bg-red-950/20 w-24 h-24 rounded-full flex items-center justify-center mb-6 border-8 border-red-100 dark:border-red-900/30">
          <AlertTriangle className="text-red-500 dark:text-red-400 w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Access Denied</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
          You do not have the required permissions to view or manage users. This area is restricted to administrators only.
        </p>
        <Button onClick={() => navigate('/admin')} variant="outline" className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 rounded-xl">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">View and manage system administrators and HR accounts.</p>
        </div>
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 gap-2 shadow-sm rounded-lg"
          onClick={() => setIsAddUserOpen(true)}
        >
           <PlusCircle size={16} />
           Register New User
        </Button>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users by name..."
                className="pl-9 h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Name</th>
                <th className="px-6 py-4 font-medium tracking-wider">NIK</th>
                <th className="px-6 py-4 font-medium tracking-wider">Roles</th>
                <th className="px-6 py-4 font-medium tracking-wider w-[150px]">Created At</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading || isAuthorized === null ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{user.username}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {user.roles.map((role) => (
                          <span key={role} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openRolesModal(user)} className="cursor-pointer">
                            <Shield className="mr-2 h-4 w-4 text-slate-400" />
                            Manage Roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4 text-slate-400" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(user.id)} className="cursor-pointer text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Register New User</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Create a new HR or Admin account. They can use these credentials to log in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser}>
            <div className="grid gap-4 py-4">
              {addError && (
                <div className="text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900/50">
                  {addError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-slate-900 dark:text-slate-300">Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. John Doe"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="username" className="text-slate-900 dark:text-slate-300">Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. johndoe"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-slate-900 dark:text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="role" className="text-slate-900 dark:text-slate-300">Initial Role</Label>
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1 text-base shadow-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  value={addForm.roleId}
                  onChange={(e) => setAddForm({ ...addForm, roleId: e.target.value })}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Edit User</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Update name, username, or change password for this account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser}>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900/50">
                  {editError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-name" className="text-slate-900 dark:text-slate-300">Full Name</Label>
                <Input
                  id="edit-name"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-username" className="text-slate-900 dark:text-slate-300">Username</Label>
                <Input
                  id="edit-username"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-password" className="text-slate-900 dark:text-slate-300">New Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={isRolesOpen} onOpenChange={setIsRolesOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Manage Roles - <span className="text-slate-500 dark:text-slate-400 font-normal">{managingUser?.name}</span></DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Assign or remove roles for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
             {rolesError && (
               <div className="text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900/50 mb-4">
                 {rolesError}
               </div>
             )}

             {rolesLoading && <div className="text-sm text-center text-slate-500 dark:text-slate-400 mb-4">Updating roles...</div>}

             <div className="space-y-3">
                {roles.length === 0 ? (
                  <div className="text-sm text-center text-slate-500 dark:text-slate-400 py-4">Loading roles...</div>
                ) : (
                  roles.map(role => {
                    const hasRole = managingUser?.roles.includes(role.name);
                    return (
                      <div key={role.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{role.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={hasRole ? 'destructive' : 'outline'}
                          disabled={rolesLoading}
                          onClick={() => handleToggleRole(role.name, role.id)}
                          className={!hasRole ? "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" : ""}
                        >
                          {hasRole ? 'Remove' : 'Assign'}
                        </Button>
                      </div>
                    );
                  })
                )}
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRolesOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 w-full sm:w-auto">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
