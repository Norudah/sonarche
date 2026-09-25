import io
import json
import os
import subprocess
import sys
import unittest

import protocol

# A title that cp1252 cannot represent, of the kind an upload hands out daily:
# a combining accent, an emoji, and a fullwidth bar.
HOSTILE = "Ně́on 🎵 ｜ Live"


class WireEncodingTest(unittest.TestCase):
    """Run in a subprocess under `PYTHONIOENCODING=cp1252` (the Windows default),
    since this process's own stdout is already UTF-8.
    """

    def _run(self, script: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, "-c", script],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env={**os.environ, "PYTHONIOENCODING": "cp1252"},
            capture_output=True,
            encoding="utf-8",
            timeout=30,
        )

    def test_a_title_cp1252_cannot_hold_still_reaches_the_wire(self):
        proc = self._run(
            "import protocol\n"
            f"protocol.send_event('req-1', 'download_progress', {{'title': {HOSTILE!r}}})\n"
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["data"]["title"], HOSTILE)

    def test_the_same_title_survives_a_log_line(self):
        """`log` writes to stderr, which is the same locale encoding and was the
        same crash — just one nobody would have blamed the protocol for."""
        proc = self._run(f"import protocol\nprotocol.log({HOSTILE!r})\n")

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(HOSTILE, proc.stderr)

    def test_a_lone_surrogate_costs_a_character_not_the_job(self):
        """Lone surrogates from invalid Windows filenames must not fail the job."""
        proc = self._run(
            "import protocol\n"
            "protocol.send_event('req-1', 'e', {'title': 'bad \\udce9 name'})\n"
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["data"]["title"], "bad ? name")

    def test_a_request_carrying_one_can_still_be_read(self):
        """The mirror bug: stdin decodes with the same locale encoding, so a
        request with an accent in it would have died on the way in."""
        proc = subprocess.run(
            [sys.executable, "-c", "import sys, json, protocol\n"
             "print(json.load(sys.stdin)['q'], file=sys.stderr)\n"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env={**os.environ, "PYTHONIOENCODING": "cp1252"},
            input=json.dumps({"q": HOSTILE}, ensure_ascii=False),
            capture_output=True,
            encoding="utf-8",
            timeout=30,
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(HOSTILE, proc.stderr)


class WireShapeTest(unittest.TestCase):
    def setUp(self):
        self.buffer = io.StringIO()
        self._real, protocol._wire = protocol._wire, self.buffer
        self.addCleanup(lambda: setattr(protocol, "_wire", self._real))

    def sent(self) -> dict:
        return json.loads(self.buffer.getvalue())

    def test_one_line_per_message_so_the_reader_can_split_on_newlines(self):
        protocol.send_event("req-1", "download_progress", {"title": HOSTILE})

        written = self.buffer.getvalue()
        self.assertTrue(written.endswith("\n"))
        self.assertEqual(written.count("\n"), 1)

    def test_characters_go_out_raw_not_escaped(self):
        """`ensure_ascii=False` keeps accents at their UTF-8 size."""
        protocol.send_result("req-1", {"title": HOSTILE})

        self.assertIn(HOSTILE, self.buffer.getvalue())
        self.assertEqual(self.sent()["result"]["title"], HOSTILE)

    def test_an_error_says_which_request_it_belongs_to(self):
        protocol.send_error("req-7", "download_failed", HOSTILE)

        self.assertEqual(self.sent(), {
            "id": "req-7",
            "ok": False,
            "error": {"code": "download_failed", "message": HOSTILE},
        })


if __name__ == "__main__":
    unittest.main()
