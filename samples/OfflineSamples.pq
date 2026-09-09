let
    // Select "cyclic-services" or "reciprocal-accounts". No files or network are read.
    Dataset = "cyclic-services",
    Schema = type table [
        SourceID = text,
        TargetID = text,
        RelationshipType = text,
        EdgeID = text,
        Weight = nullable number,
        DurationMs = number,
        EventCount = Int64.Type
    ],
    CyclicServices = #table(Schema, {
        {"Gateway", "Orders", "calls", "S01", 120, 18, 120},
        {"Orders", "Payments", "calls", "S02", 90, 32, 90},
        {"Payments", "Ledger", "writes", "S03", 85, 12, 85},
        {"Ledger", "Orders", "reconciles", "S04", 15, 22, 15},
        {"Orders", "Gateway", "responds", "S05", 118, 17, 118},
        {"Gateway", "Orders", "monitors", "S06", 12, 4, 12},
        {"Orders", "Orders", "retries", "S07", 6, 40, 6},
        {"Payments", "Alerts", "emits", "S08", 8, 5, 8},
        {"Alerts", "Gateway", "notifies", "S09", 8, 9, 8},
        {"Orders", "Inventory", "reserves", "S10", 100, 14, 100},
        {"Inventory", "Orders", "confirms", "S11", 97, 11, 97},
        {"Orders", "Payments", "calls", "S12", 10, 30, 10},
        {"Archive", "Backup", "copies", "S13", 25, 80, 25},
        {"Backup", "Archive", "verifies", "S14", 25, 70, 25}
    }),
    ReciprocalAccounts = #table(Schema, {
        {"0001", "0002", "transfer", "T01", 100, 20, 1},
        {"0002", "0001", "transfer", "T02", 40, 18, 1},
        {"0002", "0003", "transfer", "T03", 75, 24, 1},
        {"0003", "0001", "transfer", "T04", 25, 21, 1},
        {"0001", "0002", "transfer", "T05", 30, 22, 1},
        {"0001", "0002", "fee", "T06", 2, 5, 1},
        {"0003", "0003", "adjustment", "T07", 5, 8, 1},
        {"0003", "0004", "transfer", "T08", 50, 25, 1},
        {"0004", "0005", "transfer", "T09", 20, 30, 1},
        {"0005", "0004", "refund", "T10", 5, 27, 1},
        {"0001", "0002", "transfer", "T01", 20, 26, 1},
        {"0005", "0006", "transfer", "T11", 0, 16, 1},
        {"0006", "0005", "transfer", "T12", null, 15, 1},
        {"0006", "0004", "adjustment", "T13", -3, 12, 1},
        {"0007", "0008", "transfer", "T-CONFLICT", 10, 14, 1},
        {"0008", "0007", "transfer", "T-CONFLICT", 10, 14, 1}
    }),
    Selected =
        if Dataset = "cyclic-services" then CyclicServices
        else if Dataset = "reciprocal-accounts" then ReciprocalAccounts
        else error "Choose cyclic-services or reciprocal-accounts."
in
    Selected
