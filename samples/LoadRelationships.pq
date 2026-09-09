let
    // Replace with the absolute path of either supplied local CSV file.
    CsvPath = "C:\Atlyn\samples\cyclic-services.csv",
    Source = Csv.Document(
        File.Contents(CsvPath),
        [Delimiter = ",", Columns = 7, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Types = Table.TransformColumnTypes(
        Headers,
        {
            {"SourceID", type text},
            {"TargetID", type text},
            {"RelationshipType", type text},
            {"EdgeID", type text},
            {"Weight", type number},
            {"DurationMs", type number},
            {"EventCount", Int64.Type}
        },
        "en-US"
    )
in
    Types
