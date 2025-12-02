import { useState, memo, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import * as Select from '@ariakit/react/select';
import { FileText, LogOut, Database, Bookmark, MessageSquareQuote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  LinkIcon,
  GearIcon,
  DropdownMenuSeparator,
  Avatar,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Blocks,
} from '@librechat/client';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import FilesView from '~/components/Chat/Input/Files/FilesView';
import MemoryViewer from '~/components/SidePanel/Memories/MemoryViewer';
import BookmarkPanel from '~/components/SidePanel/Bookmarks/BookmarkPanel';
import PromptsAccordion from '~/components/Prompts/PromptsAccordion';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';
import store from '~/store';
import { SystemRoles } from 'librechat-data-provider';

function AccountSettings() {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useRecoilState(store.showFiles);
  const [showMemories, setShowMemories] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  // const [showAttachFiles, setShowAttachFiles] = useState(false);
  const navigate = useNavigate();
  const isAdmin = useMemo(() => user?.role === SystemRoles.ADMIN, [user?.role]);

  return (
    <Select.SelectProvider>
      <Select.Select
        aria-label={localize('com_nav_account_settings')}
        data-testid="nav-user"
        className="mt-text-sm flex h-auto w-full items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out hover:bg-surface-hover"
      >
        <div className="-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0">
          <div className="relative flex">
            <Avatar user={user} size={32} />
          </div>
        </div>
        <div
          className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
          style={{ marginTop: '0', marginLeft: '0' }}
        >
          {user?.name ?? user?.username ?? localize('com_nav_user')}
        </div>
      </Select.Select>
      <Select.SelectPopover
        className="popover-ui w-[235px]"
        style={{
          transformOrigin: 'bottom',
          marginRight: '0px',
          translate: '0px',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user?.email ?? localize('com_nav_user')}
        </div>
        <DropdownMenuSeparator />
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
              {localize('com_nav_balance')}:{' '}
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowMemories(true)}
          className="select-item text-sm"
        >
          <Database className="icon-md" aria-hidden="true" />
          {localize('com_ui_memories')}
        </Select.SelectItem>
        {/*<Select.SelectItem*/}
        {/*  value=""*/}
        {/*  onClick={() => setShowAttachFiles(true)}*/}
        {/*  className="select-item text-sm"*/}
        {/*>*/}
        {/*  <AttachmentIcon className="icon-md" aria-hidden="true" />*/}
        {/*  {localize('com_sidepanel_attach_files')}*/}
        {/*</Select.SelectItem>*/}
        <Select.SelectItem
          value=""
          onClick={() => setShowPrompts(true)}
          className="select-item text-sm"
        >
          <MessageSquareQuote className="icon-md" aria-hidden="true" />
          {localize('com_ui_prompts')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowFiles(true)}
          className="select-item text-sm"
        >
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowBookmarks(true)}
          className="select-item text-sm"
        >
          <Bookmark className="icon-md" aria-hidden="true" />
          {localize('com_ui_bookmarks')}
        </Select.SelectItem>
        {isAdmin && (
          <Select.SelectItem
            value=""
            onClick={() => navigate('/agent-management')}
            className="select-item text-sm"
          >
            <Blocks className="icon-md" aria-hidden="true" />
            {localize('com_nav_agent_management')}
          </Select.SelectItem>
        )}
        {startupConfig?.helpAndFaqURL !== '/' && (
          <Select.SelectItem
            value=""
            onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
            className="select-item text-sm"
          >
            <LinkIcon aria-hidden="true" />
            {localize('com_nav_help_faq')}
          </Select.SelectItem>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowSettings(true)}
          className="select-item text-sm"
        >
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Select.SelectItem>
        <DropdownMenuSeparator />
        <Select.SelectItem
          aria-selected={true}
          onClick={() => logout()}
          value="logout"
          className="select-item text-sm"
        >
          <LogOut className="icon-md" />
          {localize('com_nav_log_out')}
        </Select.SelectItem>
      </Select.SelectPopover>
      {showFiles && <FilesView open={showFiles} onOpenChange={setShowFiles} />}
      {showMemories && (
        <OGDialog open={showMemories} onOpenChange={setShowMemories}>
          <OGDialogContent className="w-11/12 max-w-4xl bg-background text-text-primary">
            <OGDialogHeader>
              <OGDialogTitle>{localize('com_ui_memories')}</OGDialogTitle>
            </OGDialogHeader>
            <div className="max-h-[70vh]">
              <MemoryViewer />
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
      {showPrompts && (
        <OGDialog open={showPrompts} onOpenChange={setShowPrompts}>
          <OGDialogContent className="w-11/12 max-w-4xl bg-background text-text-primary">
            <OGDialogHeader>
              <OGDialogTitle>{localize('com_ui_prompts')}</OGDialogTitle>
            </OGDialogHeader>
            <div className="max-h-[70vh]">
              <PromptsAccordion />
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
      {/*{showAttachFiles && (*/}
      {/*  <OGDialog open={showAttachFiles} onOpenChange={setShowAttachFiles}>*/}
      {/*    <OGDialogContent className="w-11/12 max-w-4xl bg-background text-text-primary">*/}
      {/*      <OGDialogHeader>*/}
      {/*        <OGDialogTitle>{localize('com_sidepanel_attach_files')}</OGDialogTitle>*/}
      {/*      </OGDialogHeader>*/}
      {/*      <div className="max-h-[70vh]">*/}
      {/*        <FilesPanel />*/}
      {/*      </div>*/}
      {/*    </OGDialogContent>*/}
      {/*  </OGDialog>*/}
      {/*)}*/}
      {showBookmarks && (
        <OGDialog open={showBookmarks} onOpenChange={setShowBookmarks}>
          <OGDialogContent className="w-11/12 max-w-4xl bg-background text-text-primary">
            <OGDialogHeader>
              <OGDialogTitle>{localize('com_ui_bookmarks')}</OGDialogTitle>
            </OGDialogHeader>
            <div className="max-h-[70vh]">
              <BookmarkPanel />
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Select.SelectProvider>
  );
}

export default memo(AccountSettings);
