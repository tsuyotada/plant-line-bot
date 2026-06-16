-- 写真分析の構造化フィールドを plant_photos に追加
-- Supabase SQL エディタで実行してください

ALTER TABLE plant_photos
  ADD COLUMN IF NOT EXISTS site_comment           text,
  ADD COLUMN IF NOT EXISTS line_message           text,
  ADD COLUMN IF NOT EXISTS change_summary         text,
  ADD COLUMN IF NOT EXISTS care_advice            text,
  ADD COLUMN IF NOT EXISTS watch_point            text,
  ADD COLUMN IF NOT EXISTS compared_with_photo_id uuid REFERENCES plant_photos(id),
  ADD COLUMN IF NOT EXISTS analysis_version       smallint DEFAULT 1;

COMMENT ON COLUMN plant_photos.site_comment           IS 'Web表示用コメント（詳しめ）';
COMMENT ON COLUMN plant_photos.line_message           IS 'LINE返信用短文';
COMMENT ON COLUMN plant_photos.change_summary         IS '前回写真からの変化まとめ';
COMMENT ON COLUMN plant_photos.care_advice            IS '今日やるとよいこと';
COMMENT ON COLUMN plant_photos.watch_point            IS '次に見るとよいポイント';
COMMENT ON COLUMN plant_photos.compared_with_photo_id IS '比較元写真のID';
COMMENT ON COLUMN plant_photos.analysis_version       IS '分析バージョン（1=単発,2=比較）';
