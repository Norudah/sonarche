import unittest

from net import read_bounded


class FakeResponse:
    def __init__(self, chunks):
        self._chunks = chunks

    def iter_content(self, chunk_size):
        yield from self._chunks


class ReadBoundedTest(unittest.TestCase):
    def test_a_body_under_the_cap_arrives_whole(self):
        resp = FakeResponse([b"abc", b"def"])
        self.assertEqual(read_bounded(resp, 10), b"abcdef")

    def test_a_body_over_the_cap_raises_mid_stream(self):
        # An endless generator: without the mid-stream stop this would hang,
        # which is exactly the unbounded `resp.content` failure mode.
        def endless():
            while True:
                yield b"x" * 1024

        resp = FakeResponse(endless())
        with self.assertRaises(RuntimeError):
            read_bounded(resp, 4096)

    def test_the_cap_is_inclusive(self):
        resp = FakeResponse([b"12345"])
        self.assertEqual(read_bounded(resp, 5), b"12345")
        with self.assertRaises(RuntimeError):
            read_bounded(FakeResponse([b"123456"]), 5)

    def test_an_empty_body_is_just_empty(self):
        self.assertEqual(read_bounded(FakeResponse([]), 5), b"")


if __name__ == "__main__":
    unittest.main()
