import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/localization/app_translations.dart';

class LanguageController extends GetxController {
  final RxString _currentLanguage = 'km'.obs; // Default to Khmer

  String get currentLanguage => _currentLanguage.value;

  @override
  void onInit() {
    super.onInit();
    _loadLanguagePreference();
  }

  Future<void> _loadLanguagePreference() async {
    final prefs = await SharedPreferences.getInstance();
    _currentLanguage.value = prefs.getString('app_language') ?? 'km';
  }

  Future<void> setLanguage(String langCode) async {
    if (_currentLanguage.value != langCode) {
      _currentLanguage.value = langCode;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_language', langCode);
    }
  }

  String tr(String key) {
    return AppTranslations.getText(_currentLanguage.value, key);
  }
}
