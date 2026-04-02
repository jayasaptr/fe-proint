import { TablePagination } from "@/components/TablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  getOrgRecsMasterList,
  getUserOrgRecs,
  setAdminUser,
  updateAdminUser,
  type AdminUser,
  type UserOrgRec,
} from "@/lib/api/users";
import { format } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Edit,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Forms
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const [addForm, setAddForm] = useState({ jde: "", name: "" });
  const [addUserOrgs, setAddUserOrgs] = useState<UserOrgRec[]>([]);
  const [editForm, setEditForm] = useState({
    originalJde: "",
    jde: "",
    name: "",
  });

  const [editUserOrgs, setEditUserOrgs] = useState<UserOrgRec[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const [masterOrgs, setMasterOrgs] = useState<UserOrgRec[]>([]);
  const [masterOrgsLoading, setMasterOrgsLoading] = useState(false);

  const context = useOutletContext<{ currentUser: any }>();
  const currentUser = context?.currentUser;

  useEffect(() => {
    if (currentUser !== null && currentUser !== undefined) {
      if (currentUser?.is_admin) {
        setIsAuthorized(true);
        fetchUsers();
        fetchMasterOrgs();
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    }
  }, [currentUser]);

  const fetchMasterOrgs = async () => {
    try {
      setMasterOrgsLoading(true);
      const data = await getOrgRecsMasterList();
      setMasterOrgs(data);
    } catch (error) {
      console.error("Failed to fetch master organizations", error);
    } finally {
      setMasterOrgsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getAdminUsers();
      // data might be array directly based on our implementation
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error("Gagal mengambil data user");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter((u) =>
      u.jde?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [users, searchTerm]);

  const totalPages = Math.ceil(filteredUsers.length / perPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * perPage,
    page * perPage,
  );

  // Add Item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!addForm.jde) {
      setFormError("JDE wajib diisi");
      return;
    }

    try {
      setFormLoading(true);
      await createAdminUser({
        jde: addForm.jde,
        name: addForm.name,
        is_admin: false,
        rc_org_recs: addUserOrgs,
      });

      toast.success("User berhasil ditambahkan");
      setIsAddOpen(false);
      setAddForm({ jde: "", name: "" });
      setAddUserOrgs([]);
      fetchUsers();
    } catch (error: any) {
      setFormError(error.response?.data?.message || "Gagal menambahkan user");
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Item
  const openEditModal = async (user: AdminUser) => {
    setEditForm({
      originalJde: user.jde,
      jde: user.jde,
      name: user.name || "",
    });
    setFormError("");
    setIsEditOpen(true);
    setEditUserOrgs([]);

    try {
      setOrgsLoading(true);
      const orgs = await getUserOrgRecs(user.jde);
      setEditUserOrgs(orgs);
    } catch (err) {
      console.error("Failed to fetch org recs", err);
      toast.error("Gagal mengambil data organisasi user");
    } finally {
      setOrgsLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      setFormLoading(true);
      const updateData: any = {
        jde: editForm.jde,
        name: editForm.name,
        rc_org_recs: editUserOrgs,
      };

      await updateAdminUser(editForm.originalJde, updateData);

      toast.success("User berhasil diupdate");
      setIsEditOpen(false);
      fetchUsers();
    } catch (error: any) {
      setFormError(error.response?.data?.message || "Gagal mengupdate user");
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Item
  const confirmDelete = (jde: string) => {
    setUserToDelete(jde);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      setFormLoading(true);
      await deleteAdminUser(userToDelete);
      toast.success(`User ${userToDelete} berhasil dihapus`);
      setIsDeleteOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleAdmin = async (user: AdminUser, checked: boolean) => {
    // Optimistic UI Update: Langsung update state lokal tanpa loading screen
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_admin: checked } : u)),
    );

    try {
      await setAdminUser(user.jde, { is_admin: checked });
      toast.success(`Berhasil mengubah status admin untuk ${user.jde}`);
    } catch (error: any) {
      // Revert back if it fails
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_admin: !checked } : u)),
      );
      toast.error(
        error.response?.data?.message || "Gagal mengubah status admin",
      );
    }
  };

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-in fade-in duration-500 text-center">
        <div className="bg-red-50 dark:bg-red-950/20 w-24 h-24 rounded-full flex items-center justify-center mb-6 border-8 border-red-100 dark:border-red-900/30">
          <AlertTriangle className="text-red-500 dark:text-red-400 w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          Access Denied
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
          You do not have the required permissions to view or manage users. This
          area is restricted to administrators only.
        </p>
        <Button
          onClick={() => navigate("/admin")}
          variant="outline"
          className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 rounded-xl"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Admin Users Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View and manage administrator access and credentials.
          </p>
        </div>
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-orange-500 dark:hover:bg-orange-600 dark:text-white gap-2 shadow-sm rounded-lg"
          onClick={() => {
            setIsAddOpen(true);
            setAddForm({ jde: "", name: "" });
            setAddUserOrgs([]);
          }}
        >
          <PlusCircle size={16} />
          Register New User
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by JDE..."
              className="pl-9 h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider w-16 text-center">
                  ID
                </th>
                <th className="px-6 py-4 font-medium tracking-wider">JDE</th>
                <th className="px-6 py-4 font-medium tracking-wider">Name</th>
                <th className="px-6 py-4 font-medium tracking-wider text-center">
                  Status
                </th>
                <th className="px-6 py-4 font-medium tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-4 font-medium tracking-wider text-right w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading || isAuthorized === null ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading
                      data...
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">
                      {user.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {user.jde}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {user.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center gap-3">
                        {user.is_admin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-500/20 w-[75px] justify-center">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-[75px] justify-center">
                            User
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {user.created_at
                        ? format(
                            new Date(user.created_at),
                            "dd MMM yyyy, HH:mm",
                          )
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-2 mr-2">
                          <Label
                            htmlFor={`switch-${user.id}`}
                            className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer"
                          >
                            Admin Access
                          </Label>
                          <Switch
                            id={`switch-${user.id}`}
                            checked={user.is_admin}
                            onCheckedChange={(checked) =>
                              handleToggleAdmin(user, checked)
                            }
                            className="data-[state=checked]:bg-orange-500"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 dark:hover:text-orange-400 focus:outline-none"
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 focus:outline-none"
                          onClick={() => confirmDelete(user.jde)}
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Register New User
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Create a new user access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="grid gap-4 py-4">
              {formError && (
                <div className="text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900/50">
                  {formError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="add-name"
                  className="text-slate-900 dark:text-slate-300"
                >
                  Name
                </Label>
                <Input
                  id="add-name"
                  placeholder="e.g. John Doe"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="add-jde"
                  className="text-slate-900 dark:text-slate-300"
                >
                  JDE Number
                </Label>
                <Input
                  id="add-jde"
                  placeholder="e.g. 110362"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  value={addForm.jde}
                  onChange={(e) =>
                    setAddForm({ ...addForm, jde: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-900 dark:text-slate-300">
                  Organizational Records (Optional)
                </Label>
                {masterOrgsLoading ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching
                    organizations...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-normal"
                        >
                          {addUserOrgs.length > 0
                            ? `${addUserOrgs.length} organization(s) selected`
                            : "Select organizations..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[375px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search organization..." />
                          <CommandList>
                            <CommandEmpty>No organization found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  if (
                                    addUserOrgs.length === masterOrgs.length &&
                                    masterOrgs.length > 0
                                  ) {
                                    setAddUserOrgs([]);
                                  } else {
                                    setAddUserOrgs([...masterOrgs]);
                                  }
                                }}
                                className="font-semibold text-slate-800 dark:text-slate-200"
                              >
                                <div
                                  className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-slate-400 dark:border-slate-600 ${
                                    addUserOrgs.length === masterOrgs.length &&
                                    masterOrgs.length > 0
                                      ? "bg-orange-500 border-none text-white"
                                      : "opacity-50 [&_svg]:invisible"
                                  }`}
                                >
                                  <Check className="h-3 w-3" />
                                </div>
                                Select All Organizations
                              </CommandItem>

                              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 font-normal" />

                              {masterOrgs.map((org) => {
                                const isSelected = addUserOrgs.some(
                                  (o) => o.OrgRecId === org.OrgRecId,
                                );
                                return (
                                  <CommandItem
                                    key={org.OrgRecId}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setAddUserOrgs(
                                          addUserOrgs.filter(
                                            (o) => o.OrgRecId !== org.OrgRecId,
                                          ),
                                        );
                                      } else {
                                        setAddUserOrgs([...addUserOrgs, org]);
                                      }
                                    }}
                                  >
                                    <div
                                      className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${
                                        isSelected
                                          ? "bg-orange-500 border-none text-white"
                                          : "border-slate-300 dark:border-slate-700 opacity-50 [&_svg]:invisible"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" />
                                    </div>
                                    {org.OrgRecName} ({org.OrgRecCode})
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Show selected chips below */}
                    {addUserOrgs.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 max-h-[120px] overflow-y-auto p-1">
                        {addUserOrgs.map((org) => (
                          <Badge
                            key={org.OrgRecId}
                            variant="secondary"
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1 px-2 font-normal"
                          >
                            {org.OrgRecName || org.OrgRecCode || org.OrgRecId}
                            <button
                              type="button"
                              onClick={() => {
                                setAddUserOrgs(
                                  addUserOrgs.filter(
                                    (o) => o.OrgRecId !== org.OrgRecId,
                                  ),
                                );
                              }}
                              className="ml-1.5 hover:text-red-500 focus:outline-none"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formLoading}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {formLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Edit User
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Update user details and permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              {formError && (
                <div className="text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900/50">
                  {formError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-name"
                  className="text-slate-900 dark:text-slate-300"
                >
                  Name
                </Label>
                <Input
                  id="edit-name"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-jde"
                  className="text-slate-900 dark:text-slate-300"
                >
                  JDE Number
                </Label>
                <Input
                  id="edit-jde"
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  value={editForm.jde}
                  onChange={(e) =>
                    setEditForm({ ...editForm, jde: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-900 dark:text-slate-300">
                  Organizational Records
                </Label>
                {orgsLoading ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching
                    organizations...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-normal"
                        >
                          {editUserOrgs.length > 0
                            ? `${editUserOrgs.length} organization(s) selected`
                            : "Select organizations..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[375px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search organization..." />
                          <CommandList>
                            {masterOrgsLoading ? (
                              <div className="p-4 text-sm text-center text-slate-500">
                                Loading master list...
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>
                                  No organization found.
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      if (
                                        editUserOrgs.length ===
                                          masterOrgs.length &&
                                        masterOrgs.length > 0
                                      ) {
                                        setEditUserOrgs([]);
                                      } else {
                                        setEditUserOrgs([...masterOrgs]);
                                      }
                                    }}
                                    className="font-semibold text-slate-800 dark:text-slate-200"
                                  >
                                    <div
                                      className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-slate-400 dark:border-slate-600 ${
                                        editUserOrgs.length ===
                                          masterOrgs.length &&
                                        masterOrgs.length > 0
                                          ? "bg-orange-500 border-none text-white"
                                          : "opacity-50 [&_svg]:invisible"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" />
                                    </div>
                                    Select All Organizations
                                  </CommandItem>

                                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 font-normal" />

                                  {masterOrgs.map((org) => {
                                    const isSelected = editUserOrgs.some(
                                      (o) => o.OrgRecId === org.OrgRecId,
                                    );
                                    return (
                                      <CommandItem
                                        key={org.OrgRecId}
                                        onSelect={() => {
                                          if (isSelected) {
                                            setEditUserOrgs(
                                              editUserOrgs.filter(
                                                (o) =>
                                                  o.OrgRecId !== org.OrgRecId,
                                              ),
                                            );
                                          } else {
                                            setEditUserOrgs([
                                              ...editUserOrgs,
                                              org,
                                            ]);
                                          }
                                        }}
                                      >
                                        <div
                                          className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${
                                            isSelected
                                              ? "bg-orange-500 border-none text-white"
                                              : "border-slate-300 dark:border-slate-700 opacity-50 [&_svg]:invisible"
                                          }`}
                                        >
                                          <Check className="h-3 w-3" />
                                        </div>
                                        {org.OrgRecName} ({org.OrgRecCode})
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Show selected chips below */}
                    {editUserOrgs.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 max-h-[120px] overflow-y-auto p-1">
                        {editUserOrgs.map((org) => (
                          <Badge
                            key={org.OrgRecId}
                            variant="secondary"
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1 px-2 font-normal"
                          >
                            {org.OrgRecName || org.OrgRecCode || org.OrgRecId}
                            <button
                              type="button"
                              onClick={() => {
                                setEditUserOrgs(
                                  editUserOrgs.filter(
                                    (o) => o.OrgRecId !== org.OrgRecId,
                                  ),
                                );
                              }}
                              className="ml-1.5 hover:text-red-500 focus:outline-none"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formLoading}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {formLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl text-slate-900 dark:text-white">
                Delete User
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Apakah Anda benar-benar yakin ingin menghapus akses user{" "}
              <strong>{userToDelete}</strong>? Aksi ini akan mencabut seluruh
              kredensial dan hak akses milik user secara permanen dari sistem
              E-Recruitment DH.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:space-x-3">
            <AlertDialogCancel className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              Batalkan
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={formLoading}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500"
            >
              {formLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
