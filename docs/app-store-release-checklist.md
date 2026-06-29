# App Store Release Checklist

## Account

- Join the Apple Developer Program with the Apple ID `502322296@qq.com`.
- Keep two-factor authentication enabled.
- Confirm the legal seller name, tax, banking, and agreements in App Store Connect.

## Identifiers And Capabilities

- Register the bundle ID currently used by the project: `com.miemie.familyhub`.
- Enable iCloud / CloudKit for the bundle ID.
- Enable Push Notifications for the bundle ID.
- Confirm background modes are justified by the product copy: location for mutual distance updates, remote notification for family posts.

## CloudKit

- Create the CloudKit container `iCloud.com.miemie.familyhub`.
- Add the `FamilyPost` record type with fields: `kind`, `todoStatus`, `title`, `body`, `authorName`, `createdAt`, `hasPhoto`.
- Confirm the `miemie-family-post-changes` query subscription is created in development after the first authorized launch.
- Before release, deploy the CloudKit schema from Development to Production.

## App Store Connect

- Create the app record with the final app name `miemie`, subtitle, category `Lifestyle`, and bundle ID.
- Add screenshots for current iPhone sizes.
- Fill privacy nutrition labels for location, user content, identifiers, and notifications.
- Explain location usage clearly in review notes: both adults opt in, distance display is for family coordination, and background updates are low power.

## Build Submission

- Set the paid Apple Developer Team in Xcode Signing & Capabilities.
- Archive with Release configuration.
- Upload through Xcode Organizer or Transporter.
- Submit first through TestFlight, then App Review after a real-device smoke test.

## Current Device Test Status

- Connected iPhone detected: `iPhone (26.5.1)` with device ID `00008150-001643C82142401C`.
- Unsigned iPhoneOS build succeeds, so the app compiles for arm64 device SDK.
- Signed device build currently stops at Apple signing setup: Xcode reports that `MieMie` requires a development team.
- To install on the phone, open the project in Xcode, select target `MieMie`, choose a Team under Signing & Capabilities, then build to the connected iPhone. For iCloud/Push and App Store distribution, use a paid Apple Developer Program team.
