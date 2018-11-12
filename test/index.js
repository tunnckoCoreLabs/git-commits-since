import path from 'path';
import test from 'asia';
import fs from 'fs-extra';
import dedent from 'dedent';
import simpleGit from 'simple-git/promise';
import { applyPlugins, plugins, parse, check } from 'parse-commit-message';

import gitCommitsSince from '../src';
import { __dirname } from './cjs';

function parseCommitPluginForGitCommitsSince(rawCommit, { commits = [] }) {
  const res = applyPlugins(plugins, check(parse(rawCommit)));
  commits.push(...res);
  return { commits };
}

/* eslint-disable-next-line max-statements */
test('basic test', async (t) => {
  const fakeCwd = path.join(__dirname, 'fixtures', 'qq5');
  await fs.remove(fakeCwd);
  await fs.mkdirp(fakeCwd);
  await fs.writeFile(path.join(fakeCwd, 'foobar.txt'), 'sss');
  const git = simpleGit(fakeCwd);

  await git.init();

  // All is the default execpt `[commit] gpgsign`,
  // because i'm using it on my machine
  const localGitConfig = dedent`[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
  [user]
    name = Foo Bar Baz
    email = foobar@example.com
  [commit]
    gpgsign = false`;

  await fs.writeFile(path.join(fakeCwd, '.git', 'config'), localGitConfig);

  await git.add('./*');
  await git.commit('feat: initial blank release');
  await git.addTag('v0.1.0');

  await fs.writeFile(path.join(fakeCwd, 'foobar.txt'), 'zzzzz');
  await git.add('./*');
  await git.commit('feat: implement');

  await fs.writeFile(path.join(fakeCwd, 'fix.txt'), 'fixfix');
  await git.add('./*');
  await git.commit('fix: foo bar baz');

  await fs.writeFile(path.join(fakeCwd, 'fix2.txt'), '222xasas');
  await git.add('./*');
  await git.commit('fix: fo222222o bar baz');

  await fs.writeFile(path.join(fakeCwd, 'chore.txt'), 'chore');
  await git.add('./*');
  await git.commit('chore: foo bar baz');

  const result = await gitCommitsSince({
    cwd: fakeCwd,
    plugin: parseCommitPluginForGitCommitsSince,
  });

  const patches = result.commits.filter((x) => x.increment === 'patch');
  const minors = result.commits.filter((x) => x.increment === 'minor');

  t.ok(minors);
  t.ok(patches);

  t.strictEqual(minors.length, 1);
  t.strictEqual(patches.length, 2);
  t.strictEqual(result.from, 'v0.1.0');
  t.strictEqual(result.to, '@');

  await git.addTag(`v${result.nextVersion}`);

  await fs.writeFile(path.join(fakeCwd, 'breaking.txt'), 'breaking breaking');
  await git.add('./*');
  await git.commit('feat(api): awful change\n\nBREAKING CHANGE: yeah!');

  const res = await gitCommitsSince({
    cwd: fakeCwd,
  });

  t.ok(res.rawCommits);
  t.ok(Array.isArray(res.rawCommits));
  t.strictEqual(
    res.rawCommits[0],
    'feat(api): awful change\n\nBREAKING CHANGE: yeah!',
  );

  await fs.remove(fakeCwd);
});
