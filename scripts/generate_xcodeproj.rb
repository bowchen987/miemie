#!/usr/bin/env ruby
# frozen_string_literal: true

require "xcodeproj"

project = Xcodeproj::Project.new("MieMie.xcodeproj")
project.root_object.attributes["LastSwiftUpdateCheck"] = "2650"
project.root_object.attributes["LastUpgradeCheck"] = "2650"

app_target = project.new_target(:application, "MieMie", :ios, "17.0")
test_target = project.new_target(:unit_test_bundle, "MieMieTests", :ios, "17.0")
test_target.add_dependency(app_target)

app_group = project.main_group.new_group("MieMie", "MieMie")
test_group = project.main_group.new_group("MieMieTests", "MieMieTests")

Dir["MieMie/**/*.swift"].sort.each do |path|
  ref = app_group.new_file(path.sub("MieMie/", ""))
  app_target.add_file_references([ref])
end

assets_ref = app_group.new_file("Resources/Assets.xcassets")
app_target.add_resources([assets_ref])
app_group.new_file("Resources/Info.plist")

Dir["MieMieTests/**/*.swift"].sort.each do |path|
  ref = test_group.new_file(path.sub("MieMieTests/", ""))
  test_target.add_file_references([ref])
end

project.build_configurations.each do |config|
  config.build_settings["CLANG_ANALYZER_NONNULL"] = "YES"
  config.build_settings["CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION"] = "YES_AGGRESSIVE"
  config.build_settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "YES"
  config.build_settings["SWIFT_VERSION"] = "5.0"
end

app_target.build_configurations.each do |config|
  settings = config.build_settings
  settings["ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME"] = "AccentColor"
  settings["CODE_SIGN_ENTITLEMENTS"] = "MieMie/MieMie.entitlements"
  settings["CODE_SIGN_STYLE"] = "Automatic"
  settings["CURRENT_PROJECT_VERSION"] = "1"
  settings["DEFINES_MODULE"] = "YES"
  settings["ENABLE_PREVIEWS"] = "YES"
  settings["GENERATE_INFOPLIST_FILE"] = "NO"
  settings["INFOPLIST_FILE"] = "MieMie/Resources/Info.plist"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
  settings["MARKETING_VERSION"] = "0.1.0"
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.miemie.familyhub"
  settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  settings["SUPPORTED_PLATFORMS"] = "iphoneos iphonesimulator"
  settings["SUPPORTS_MACCATALYST"] = "NO"
  settings["SWIFT_VERSION"] = "5.0"
  settings["TARGETED_DEVICE_FAMILY"] = "1"
end

test_target.build_configurations.each do |config|
  settings = config.build_settings
  settings["BUNDLE_LOADER"] = "$(TEST_HOST)"
  settings["CODE_SIGN_STYLE"] = "Automatic"
  settings["GENERATE_INFOPLIST_FILE"] = "YES"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.miemie.familyhub.tests"
  settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  settings["SUPPORTED_PLATFORMS"] = "iphoneos iphonesimulator"
  settings["SUPPORTS_MACCATALYST"] = "NO"
  settings["SWIFT_VERSION"] = "5.0"
  settings["TARGETED_DEVICE_FAMILY"] = "1"
  settings["TEST_HOST"] = "$(BUILT_PRODUCTS_DIR)/MieMie.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/MieMie"
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app_target)
scheme.set_launch_target(app_target)
scheme.add_test_target(test_target)
scheme.save_as(project.path, "MieMie", true)
