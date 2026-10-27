"""Offline checks: no GitHub or Docker writes."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class ReleaseTests(unittest.TestCase):
    def test_channels(self):
        for tag, channel in [('v1.2.3', 'latest'), ('v1.2.3-beta', 'beta'),
                             ('v1.2.3-beta.2', 'beta'), ('refs/tags/v1.2.3-beta.1', 'beta')]:
            with self.subTest(tag=tag):
                result = subprocess.check_output(['bash', str(ROOT / 'script/release-channel.sh'), tag], text=True)
                self.assertEqual(result.strip(), channel)
        for tag in ['v1.2.3-rc.1', 'v1.2.3-betatest', 'v1.2.3-beta.1.extra', 'latest', '']:
            result = subprocess.run(['bash', str(ROOT / 'script/release-channel.sh'), tag], capture_output=True)
            self.assertNotEqual(result.returncode, 0)

    def test_release_arguments(self):
        for tag, beta in [('v1.2.3', False), ('v1.2.3-beta.1', True)]:
            with self.subTest(tag=tag), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp)
                shutil.copytree(ROOT / 'script', work / 'script')
                (work / 'build/arch').mkdir(parents=True)
                (work / 'build/arch/homebox-test').write_text('test binary')
                (work / 'bin').mkdir()
                gh = work / 'bin/gh'
                gh.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$ARGS_FILE"\n')
                gh.chmod(0o755)
                env = dict(os.environ, PATH=str(work / 'bin') + os.pathsep + os.environ['PATH'],
                           ARGS_FILE=str(work / 'args'))
                subprocess.run(['bash', 'script/pack-arch.sh', 'refs/tags/' + tag], cwd=work, env=env, check=True)
                args = (work / 'args').read_text().splitlines()
                self.assertEqual(args[:3], ['release', 'create', tag])
                title_index = args.index('--title')
                self.assertEqual(args[title_index + 1], tag.removeprefix('v'))
                self.assertEqual('--prerelease' in args, beta)
                self.assertEqual('--latest=false' in args, beta)
                self.assertIn('homebox-test.tar.gz', args)


if __name__ == '__main__':
    unittest.main()
