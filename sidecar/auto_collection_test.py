import unittest

from auto_collection import TrackFacts, looks_like_collection


def _track(album: str = "", artist: str = "", track: int = 0) -> TrackFacts:
    return TrackFacts(album=album, artist=artist, track=track)


class LooksLikeCollectionTest(unittest.TestCase):
    def test_folder_of_one_shots_is_a_collection(self):
        # The case this exists for: no album tag, every file another artist.
        tracks = [_track(artist=name) for name in ("Aphex Twin", "Boards of Canada", "Autechre")]
        self.assertTrue(looks_like_collection(tracks))

    def test_untagged_unnumbered_pile_of_one_artist_is_a_collection(self):
        tracks = [_track(artist="Muse") for _ in range(4)]
        self.assertTrue(looks_like_collection(tracks))

    def test_two_records_under_one_directory_is_a_collection(self):
        tracks = [
            _track(album="Kid A", artist="Radiohead", track=1),
            _track(album="Kid A", artist="Radiohead", track=2),
            _track(album="Amnesiac", artist="Radiohead", track=1),
        ]
        self.assertTrue(looks_like_collection(tracks))

    def test_a_tagged_album_is_left_alone(self):
        tracks = [_track(album="Kid A", artist="Radiohead", track=n) for n in (1, 2, 3)]
        self.assertFalse(looks_like_collection(tracks))

    def test_a_compilation_that_names_itself_is_left_alone(self):
        # Several artists, but the files agree they are one release: that is a
        # compilation, and it has a tracklist worth checking.
        tracks = [
            _track(album="Now 42", artist="Blur", track=1),
            _track(album="Now 42", artist="Oasis", track=2),
            _track(album="Now 42", artist="Pulp", track=3),
        ]
        self.assertFalse(looks_like_collection(tracks))

    def test_numbered_rip_of_one_artist_abstains(self):
        # No album tag, but the shape of a release whose tag was lost.
        tracks = [_track(artist="Radiohead", track=n) for n in (1, 2, 3, 4)]
        self.assertFalse(looks_like_collection(tracks))

    def test_a_partly_tagged_row_trusts_the_tag(self):
        tracks = [
            _track(album="Kid A", artist="Radiohead", track=1),
            _track(artist="Radiohead", track=2),
            _track(artist="Radiohead", track=3),
        ]
        self.assertFalse(looks_like_collection(tracks))

    def test_case_and_spacing_are_not_a_disagreement(self):
        tracks = [
            _track(album="Kid A", artist="Radiohead", track=1),
            _track(album=" kid a ", artist="radiohead", track=2),
            _track(album="KID A", artist="RADIOHEAD", track=3),
        ]
        self.assertFalse(looks_like_collection(tracks))

    def test_too_few_tracks_to_judge(self):
        tracks = [_track(artist="Aphex Twin"), _track(artist="Autechre")]
        self.assertFalse(looks_like_collection(tracks))

    def test_nothing_at_all(self):
        self.assertFalse(looks_like_collection([]))


if __name__ == "__main__":
    unittest.main()
