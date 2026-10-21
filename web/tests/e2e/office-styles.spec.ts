import {test,expect} from '@playwright/test';
import {installSnapshotRoute} from './snapshotRoute';
import {populated,session,snapshot} from '../office/fixtures';
test.setTimeout(60000);
const canvas='.officeCanvas canvas';
test('styles preserve selected session, dismissed notices, keyboard focus and separate cameras',async({page})=>{
  const polls:number[]=[];
  page.on('request',request=>{if(request.url().endsWith('/api/snapshot')&&request.method()==='GET')polls.push(Date.now());});
  const snap=populated(10);snap.sessions[1]=session('worker-0','coder','needs_human');
  await installSnapshotRoute(page,snap);await page.goto('/');
  await expect(page.locator(canvas)).toBeVisible({timeout:20000});
  const selector=page.getByLabel('Office style',{exact:true});await expect(selector).toHaveValue('botanical');
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  const dismiss=page.getByRole('button',{name:/Dismiss notice:/}).first();await dismiss.click();
  const notices=await page.locator('.officeNotice').count();
  await page.getByRole('button',{name:'Focus Research',exact:true}).click();
  const pose=await page.locator('.officeSceneRegion').getAttribute('data-pose');
  await selector.focus();await selector.selectOption('precinct');
  await expect(selector).toBeFocused();
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
  await expect(page.locator('.officeNotice')).toHaveCount(notices);
  await expect(page.locator('.officeActorLabel[data-kind="worker"]')).toHaveCount(10);
  await page.getByRole('button',{name:'Reverse view',exact:true}).click();
  const precinctPose=await page.locator('.officeSceneRegion').getAttribute('data-pose');expect(precinctPose).not.toBe(pose);
  await selector.selectOption('botanical');
  await expect.poll(()=>page.locator('.officeSceneRegion').getAttribute('data-pose')).toBe(pose);
  await selector.selectOption('precinct');
  await expect.poll(()=>page.locator('.officeSceneRegion').getAttribute('data-pose')).toBe(precinctPose);
  await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await expect(selector).toHaveValue('precinct');
  for(let i=1;i<polls.length;i++)expect(polls[i]-polls[i-1]).toBeGreaterThanOrEqual(1900);
  await page.reload();await expect(selector).toHaveValue('precinct');
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
});
test('precinct overview and room cameras expose the detailed miniature',async({page})=>{
  test.setTimeout(120000);
  await installSnapshotRoute(page,snapshot());await page.goto('/');
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
  await page.locator('.splash').waitFor({state:'detached'});
  for(const [id,name] of [['overview','Home view'],['reverse','Reverse view'],['plan','Plan view'],['lounge','Focus Break room'],['kitchen','Focus Kitchenette'],['captain','Focus Captain’s office']]) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect.poll(()=>page.locator(canvas).getAttribute('data-triangles')).not.toBeNull();
    await page.locator('.officeSceneRegion').screenshot({path:`test-results/office-evidence/precinct-${id}.png`});
  }
  await page.getByLabel('Cutaway walls',{exact:true}).uncheck();
  await page.locator('.officeSceneRegion').screenshot({path:'test-results/office-evidence/precinct-full-walls.png'});
});
test('styles latest choice wins a delayed chunk and failed loading keeps details usable',async({page})=>{
  await installSnapshotRoute(page,populated(2));
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/styles/precinct/scene.tsx*',async route=>{await gate;await route.continue();});
  await page.goto('/');const selector=page.getByLabel('Office style',{exact:true});
  await expect(page.locator(canvas)).toBeVisible({timeout:20000});
  await selector.selectOption('precinct');await selector.selectOption('botanical');release();
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Botanical Studio office scene');
  await page.unroute('**/styles/precinct/scene.tsx*');
  // A fresh page module graph gives a genuine first failed import.
  await page.reload();await expect(page.locator(canvas)).toBeVisible();
  await page.route('**/styles/precinct/scene.tsx*',route=>route.abort());
  await selector.selectOption('precinct');
  await expect(page.getByText('3D office unavailable',{exact:true})).toBeVisible();
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
  await page.getByRole('button',{name:'Use Botanical Studio',exact:true}).click();
  await expect(selector).toHaveValue('botanical');await expect(page.locator(canvas)).toBeVisible();
});
test('styles retry a failed precinct chunk while keeping source details',async({page})=>{
  let blocked=true;
  await page.route('**/styles/precinct/scene.tsx*',route=>blocked?route.abort():route.continue());
  await installSnapshotRoute(page,populated(2));await page.goto('/');
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.getByText('3D office unavailable',{exact:true})).toBeVisible();
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await page.locator('.officeSceneRegion').screenshot({path:'test-results/office-evidence/precinct-loading-failure.png'});
  blocked=false;await page.getByRole('button',{name:'Retry 3D office',exact:true}).click();
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
  await expect(page.locator('.officeCanvas canvas')).toHaveCount(1);
});
for(const [width,height] of [[1440,900],[390,844]])test(`precinct visual matrix at ${width}px`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  await installSnapshotRoute(page,populated(10));await page.goto('/');
  if(width<900)await page.getByRole('button',{name:'Show 3D office',exact:true}).click();
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  await page.locator('.splash').waitFor({state:'detached'});
  for(const theme of ['light','dark']) {
    if(theme==='dark')await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
    for(const [id,name] of [['overview','Home view'],['reverse','Reverse view'],['plan','Plan view'],['lounge','Focus Break room'],['kitchen','Focus Kitchenette'],['captain','Focus Captain’s office'],
      ...(width===1440&&theme==='light'?[['briefing','Focus Briefing room'],['side','Focus Side office'],['research','Focus Research office'],['records','Focus Records']]:[])]) {
      await page.getByRole('button',{name,exact:true}).click();
      await page.locator('.officeSceneRegion').screenshot({path:`test-results/office-evidence/precinct-${width}-${theme}-${id}.png`});
    }
  }
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await page.screenshot({path:`test-results/office-evidence/precinct-${width}-selected.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test.describe('high density precinct',()=>{
  test.use({deviceScaleFactor:2});
  test('uses a native 2x drawing buffer for detailed close-ups',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await installSnapshotRoute(page,snapshot());await page.goto('/');
    await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
    const canvas=page.locator('.officeCanvas canvas');await expect(canvas).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
    const ratio=await canvas.evaluate(c=>(c as HTMLCanvasElement).width/(c as HTMLCanvasElement).clientWidth);
    expect(ratio).toBeCloseTo(2,2);await expect(canvas).toHaveAttribute('data-render-dpr','2');
    await page.locator('.splash').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Focus Kitchenette',exact:true}).click();
    await page.locator('.officeSceneRegion').screenshot({path:'test-results/office-evidence/precinct-retina-kitchen.png'});
  });
});
test('static labels follow the current camera on its first completed render',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await installSnapshotRoute(page,snapshot());await page.goto('/');
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  await page.getByRole('button',{name:'Reverse view',exact:true}).click();
  await page.waitForResponse(r=>r.url().endsWith('/api/snapshot'));
  await page.getByRole('button',{name:'Focus Captain’s office',exact:true}).click();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const canvas=await page.locator('.officeCanvas canvas').boundingBox(),label=await page.getByRole('button',{name:'Room Captain’s office',exact:true}).boundingBox();
  expect(Math.abs(label!.x+label!.width/2-(canvas!.x+canvas!.width/2))).toBeLessThan(2);
});
test('compact controls leave a separate drawing area for the miniature',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await installSnapshotRoute(page,snapshot());await page.goto('/');
  await page.getByRole('button',{name:'Show 3D office',exact:true}).click();
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  const canvas=await page.locator('.officeCanvas canvas').boundingBox(),controls=await page.locator('.officeCameraControls').boundingBox();
  expect(canvas!.y).toBeGreaterThanOrEqual(controls!.y+controls!.height);
  expect(canvas!.height).toBeGreaterThanOrEqual(260);
});
test('precinct context recovery keeps selected source and presentation',async({page})=>{
  await installSnapshotRoute(page,populated(2));await page.goto('/');
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await page.locator(canvas).evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{bubbles:true,cancelable:true})));
  await page.getByRole('button',{name:'Retry 3D office',exact:true}).click();
  await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
});
test('malformed or denied storage falls back; narrow controls fit the viewport',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('para-office-presentation-v1','{bad');});
  await installSnapshotRoute(page,snapshot());await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Show 3D office',exact:true}).click();
  const selector=page.getByLabel('Office style',{exact:true});await expect(selector).toHaveValue('botanical');
  await selector.selectOption('precinct');await expect(page.locator(canvas)).toHaveAttribute('aria-label','Nine-Nine Precinct office scene');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}});});
  await page.reload();await page.getByRole('button',{name:'Show 3D office',exact:true}).click();
  await expect(selector).toHaveValue('botanical');await expect(page.locator(canvas)).toBeVisible();
});
