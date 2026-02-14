let SessionLoad = 1
let s:so_save = &g:so | let s:siso_save = &g:siso | setg so=0 siso=0 | setl so=-1 siso=-1
let v:this_session=expand("<sfile>:p")
silent only
silent tabonly
cd ~/Documents/Lifeline/Lifeline_web
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
let s:shortmess_save = &shortmess
if &shortmess =~ 'A'
  set shortmess=aoOA
else
  set shortmess=aoO
endif
badd +256 ~/Documents/Lifeline/Lifeline_web/src/components/DashboardContact.tsx
badd +167 ~/Documents/Lifeline/Lifeline_web/src/components/document.tsx
badd +1 ~/Documents/Lifeline/Lifeline_web/src/pages/addContact.tsx
badd +129 ~/Documents/Lifeline/Lifeline_web/src/components/addContactNew.tsx
badd +220 ~/Documents/Lifeline/Lifeline_web/src/pages/dashboard.tsx
badd +1 ~/Documents/Lifeline/Lifeline_web/src/types/realtime.ts
badd +243 ~/Documents/Lifeline/Lifeline_web/src/scripts/useDashboard.ts
argglobal
%argdel
edit ~/Documents/Lifeline/Lifeline_web/src/components/DashboardContact.tsx
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
wincmd =
argglobal
balt ~/Documents/Lifeline/Lifeline_web/src/components/addContactNew.tsx
setlocal foldmethod=expr
setlocal foldexpr=v:lua.LazyVim.treesitter.foldexpr()
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=99
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
40
sil! normal! zo
165
sil! normal! zo
165
sil! normal! zo
186
sil! normal! zo
210
sil! normal! zo
216
sil! normal! zo
230
sil! normal! zo
231
sil! normal! zo
252
sil! normal! zo
267
sil! normal! zo
let s:l = 269 - ((38 * winheight(0) + 25) / 51)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 269
normal! 0
wincmd w
argglobal
if bufexists(fnamemodify("~/Documents/Lifeline/Lifeline_web/src/scripts/useDashboard.ts", ":p")) | buffer ~/Documents/Lifeline/Lifeline_web/src/scripts/useDashboard.ts | else | edit ~/Documents/Lifeline/Lifeline_web/src/scripts/useDashboard.ts | endif
if &buftype ==# 'terminal'
  silent file ~/Documents/Lifeline/Lifeline_web/src/scripts/useDashboard.ts
endif
balt ~/Documents/Lifeline/Lifeline_web/src/types/realtime.ts
setlocal foldmethod=expr
setlocal foldexpr=v:lua.LazyVim.treesitter.foldexpr()
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=99
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
let s:l = 243 - ((26 * winheight(0) + 25) / 51)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 243
normal! 0
wincmd w
2wincmd w
wincmd =
tabnext 1
if exists('s:wipebuf') && len(win_findbuf(s:wipebuf)) == 0 && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20
let &shortmess = s:shortmess_save
let &winminheight = s:save_winminheight
let &winminwidth = s:save_winminwidth
let s:sx = expand("<sfile>:p:r")."x.vim"
if filereadable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &g:so = s:so_save | let &g:siso = s:siso_save
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
